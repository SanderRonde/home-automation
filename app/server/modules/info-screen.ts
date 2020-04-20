import { Credentials } from 'google-auth-library/build/src/auth/credentials';
import { calendar_v3 } from 'googleapis/build/src/apis/calendar/v3';
import { errorHandle, requireParams } from '../lib/decorators';
const optionalRequire = require('optional-require')(require);
import { ModuleConfig, AllModules } from './modules';
import { OAuth2Client } from 'google-auth-library';
import { SECRETS_FOLDER } from '../lib/constants';
import { WSWrapper, WSClient } from '../lib/ws';
import { initMiddleware } from '../lib/routes';
import { attachMessage } from '../lib/logger';
import { BotState } from '../lib/bot-state';
import { XHR, flatten } from '../lib/util';
import { ResponseLike } from './multi';
import { Bot as _Bot } from './bot';
import { ModuleMeta } from './meta';
import { google } from 'googleapis';
import * as express from 'express';
import { KeyVal } from './keyval';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as http from 'http';
import { getEnv } from '../lib/io';

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

export namespace InfoScreen {
	export const meta = new (class Meta extends ModuleMeta {
		name = 'info-screen';

		setup!: Promise<void>;

		async init(config: ModuleConfig) {
			await Routing.init(config);
			await Calendar.refresh();
		}

		async notifyModules(modules: AllModules) {
			Temperature.Internal.initModules(modules);
		}

		get bot() {
			return Bot;
		}
	})();

	export namespace Temperature {
		export namespace Internal {
			let _modules: AllModules | null = null;
			export function initModules(modules: AllModules) {
				_modules = modules;
			}

			export async function get(logObj?: any) {
				return await new _modules!.temperature.External.Handler(
					logObj || {}
				).getTemp();
			}
		}

		export namespace External {
			const openweathermapSecrets = {
				api_key: getEnv('SECRET_OPENWEATHERMAP_API_KEY', true),
				city: getEnv('SECRET_OPENWEATHERMAP_CITY', true),
				units: getEnv('SECRET_OPENWEATHERMAP_UNITS', true)
			};

			export async function get() {
				if (!openweathermapSecrets) return null;
				try {
					const response = await XHR.get(
						'http://api.openweathermap.org/data/2.5/weather',
						'openweathermap-weather',
						{
							q: openweathermapSecrets.city,
							appid: openweathermapSecrets.api_key,
							units: openweathermapSecrets.units
						}
					);
					const parsed = JSON.parse(response) as {
						coord: {
							lon: number;
							lat: number;
						};
						weather: {
							id: number;
							main: string;
							description: string;
							icon: string;
						}[];
						base: string;
						main: {
							temp: number;
							feels_like: number;
							temp_min: number;
							temp_max: number;
							pressure: number;
							humidity: number;
						};
						visibility: number;
						wind: {
							speed: number;
							deg: number;
						};
						clouds: {
							all: number;
						};
						dt: number;
						sys: {
							type: number;
							id: number;
							country: string;
							sunrise: number;
							sunset: number;
						};
						timezone: number;
						id: number;
						name: string;
						cod: number;
					};
					return {
						temp: parsed.main.temp,
						icon: `${parsed.weather[0].icon}.svg`
					};
				} catch (e) {
					console.log(e);
					return null;
				}
			}
		}

		export function getInternal(logObj?: any) {
			return Internal.get(logObj);
		}

		export function getExternal() {
			return External.get();
		}
	}

	export namespace Webpage {
		async function infoScreenHTML(randomNum: number) {
			return `<!DOCTYPE HTML>
			<html lang="en" style="background-color: rgb(0, 0, 0);">
				<head>
					<title>Info screen</title>
				</head>
				<body style="margin: 0;overflow-x: hidden;">
					<info-screen>Javascript should be enabled</info-screen>
					<script type="module" src="/info-screen/info-screen.bundle.js?n=${randomNum}"></script>
				</body>
			</html>`;
		}

		export class Handler {
			private _randomNum: number;

			constructor({ randomNum }: { randomNum: number }) {
				this._randomNum = randomNum;
			}

			@errorHandle
			public async index(res: ResponseLike, _req: express.Request) {
				res.status(200);
				res.contentType('.html');
				res.write(await infoScreenHTML(this._randomNum));
				res.end();
			}
		}
	}

	export namespace Bot {
		export interface JSON {}

		export class Bot extends BotState.Base {
			static readonly commands = {
				'/info_refesh': 'Refresh info-screen'
			};

			static readonly botName = 'InfoScreen';

			static readonly matches = Bot.createMatchMaker(
				({ matchMaker: mm }) => {
					mm(
						'/info_refresh',
						/refresh info screen/,
						async ({ logObj }) => {
							const amount = Routing.refreshClients();
							attachMessage(
								logObj,
								`Refreshed ${amount} clients`
							);
							return `Refreshed ${amount} clients`;
						}
					);
				}
			);

			constructor(_json?: JSON) {
				super();
			}

			static async match(config: {
				logObj: any;
				text: string;
				message: _Bot.TelegramMessage;
				state: _Bot.Message.StateKeeping.ChatState;
			}): Promise<_Bot.Message.MatchResponse | undefined> {
				return await this.matchLines({
					...config,
					matchConfig: Bot.matches
				});
			}

			toJSON(): JSON {
				return {};
			}
		}
	}

	export namespace API {
		export class Handler {
			constructor() {}

			@errorHandle
			@requireParams('type')
			public async getTemperature(
				res: ResponseLike,
				{
					type
				}: {
					type: 'inside' | 'outside';
				}
			) {
				const { temp, icon } = await (async (): Promise<{
					temp: number;
					icon: string;
				}> => {
					if (type === 'inside') {
						// Use temperature module
						const temp = await Temperature.getInternal(res);
						return { temp: temp!.temp, icon: 'inside.png' };
					} else {
						// Use openweathermap
						const openweathermapResponse = await Temperature.getExternal();
						if (openweathermapResponse === null)
							return {
								temp: 0,
								icon: 'questionmark.svg'
							};
						return openweathermapResponse;
					}
				})();

				attachMessage(res, `Temp: "${temp + ''}", icon: ${icon}`);
				res.status(200).write(
					JSON.stringify({
						temperature: `${Math.round(temp * 10) / 10}°`,
						icon: icon
					})
				);
				res.end();
				return temp;
			}

			@errorHandle
			public async getEvents(res: ResponseLike, {}: {}) {
				try {
					const events = await Calendar.getEvents(7);
					attachMessage(res, `Fetched ${events.length} events`);
					res.status(200).write(
						JSON.stringify({
							events
						})
					);
					res.end();
					return events;
				} catch (e) {
					res.status(500);
					res.write('calendar API not authenticated');
					res.end();
					return [];
				}
			}
		}
	}

	export namespace Calendar {
		export let authenticated: boolean = false;

		export async function refresh() {
			try {
				const credentials: Credentials = JSON.parse(
					await fs.readFile(
						path.join(SECRETS_FOLDER, 'last_tokens.json'),
						{
							encoding: 'utf8'
						}
					)
				);
				await authTokens(credentials, true);
			} catch (e) {
				console.log('Failed to re-use google code', e);
			}
		}

		let secrets: {
			client_id: string;
			client_secret: string;
			redirect_url: string;
		} = {
			client_id: getEnv('SECRET_GOOGLE_CLIENT_ID', true),
			client_secret: getEnv('SECRET_GOOGLE_CLIENT_SECRET', true),
			redirect_url: getEnv('SECRET_GOOGLE_REDIRECT_URL', true)
		};
		async function createClient() {
			if (client) return;
			const { client_id, client_secret, redirect_url } = secrets;

			client = new google.auth.OAuth2(
				client_id,
				client_secret,
				redirect_url
			);
		}

		let client: OAuth2Client | null = null;
		let calendar: calendar_v3.Calendar | null = null;
		export async function authenticateURL() {
			await createClient();

			if (client) {
				const url = client.generateAuthUrl({
					access_type: 'offline',
					scope: SCOPES
				});
				return url;
			}
			return null;
		}

		async function authTokens(tokens: Credentials, reAuth: boolean) {
			await createClient();

			if (!reAuth) {
				await fs.writeFile(
					path.join(SECRETS_FOLDER, 'last_tokens.json'),
					JSON.stringify(tokens, null, '\t'),
					{
						encoding: 'utf8'
					}
				);
			}

			client?.setCredentials(tokens);
			if (reAuth) {
				await client?.refreshAccessToken();
			}

			calendar = google.calendar({
				version: 'v3',
				auth: client!
			});

			authenticated = true;
		}

		export async function authCode(code: string) {
			await createClient();

			const { tokens } = await client!.getToken(code);
			await authTokens(tokens, false);
		}

		function getDay(dayOffset: number) {
			const date = new Date();
			date.setDate(date.getDate() + dayOffset);
			return date;
		}

		export async function getEvents(days: number) {
			const listResponse = await calendar!.calendarList.list();
			const calendars = listResponse.data.items || [];

			const colors = await calendar!.colors.get();

			const startTime = getDay(0);
			startTime.setHours(0, 0, 0);
			const endTime = getDay(days - 1);
			endTime.setHours(23, 59, 59);
			const events = await Promise.all(
				calendars.map(async calendarObj => {
					return {
						response: await calendar?.events.list({
							calendarId: calendarObj.id,
							singleEvents: true,
							orderBy: 'startTime',
							timeMin: startTime.toISOString(),
							timeMax: endTime.toISOString()
						}),
						calendar: calendarObj
					};
				})
			);
			const joined = events.map(({ response, calendar }) =>
				[...(response?.data.items || [])].map(event => {
					return {
						...event,
						color:
							event.colorId &&
							colors.data.calendar![event.colorId]
								? colors.data.calendar![event.colorId]
								: colors.data.calendar![calendar.colorId!]
					};
				})
			);
			const flatEvents = flatten(joined);
			const filter = optionalRequire(
				path.join(SECRETS_FOLDER, 'event-filter.js')
			);
			if (filter) {
				return flatEvents.filter(event => {
					return filter(event);
				});
			}
			return flatEvents;
		}
	}

	export namespace Routing {
		const clients: Set<WSClient> = new Set();

		export function refreshClients() {
			clients.forEach(client => {
				client.send(
					JSON.stringify({
						refresh: true
					})
				);
			});
			return clients.size;
		}

		export async function init({ config, randomNum }: ModuleConfig) {
			const app = express();
			const webpageHandler = new Webpage.Handler({
				randomNum
			});
			const apiHandler = new API.Handler();
			const server = http.createServer(app);
			const ws = new WSWrapper(server);

			await initMiddleware(app);

			app.all('/', async (req, res) => {
				if (!Calendar.authenticated) {
					const url = await Calendar.authenticateURL();
					if (url) {
						res.redirect(url);
						return;
					}
				}

				await webpageHandler.index(res, req);
			});
			app.get('/authorize', async (req, res) => {
				const getParams = req.query;
				const code = getParams['code'] as string;
				if (code) {
					await Calendar.authCode(code);
				}

				res.redirect('/');
			});

			app.post('/weather', async (req, res) => {
				await apiHandler.getTemperature(res, {
					...req.params,
					...req.body,
					cookies: req.cookies
				});
			});

			app.post('/calendar', async (req, res) => {
				await apiHandler.getEvents(res, {
					...req.params,
					...req.body,
					cookies: req.cookies
				});
			});

			ws.all('/blanking', async client => {
				const { send, onDead } = client;
				clients.add(client);
				const listener = KeyVal.GetSetListener.addListener(
					'room.lights.ceiling',
					async value => {
						send(
							JSON.stringify({
								blank: value === '0'
							})
						);
					}
				);
				send(
					JSON.stringify({
						blank:
							(await new KeyVal.External.Handler(
								{},
								'INFO_SCREEN.BLANKING'
							).get('room.lights.ceiling')) === '0'
					})
				);
				onDead(() => {
					KeyVal.GetSetListener.removeListener(listener);
					clients.delete(client);
				});
			});

			if (config.debug) {
				server.listen(config.ports.info, () => {
					console.log(
						`Info-screen server listening on port ${config.ports.info}`
					);
				});
			} else {
				server.listen(config.ports.info, '127.0.0.1', () => {
					console.log(
						`Info-screen server listening on port ${config.ports.info} on localhost only`
					);
				});
			}
		}
	}
}
