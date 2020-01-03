import { errorHandle, requireParams, authAll, auth } from "../lib/decorators";
import { attachMessage, ResDummy, log, getTime } from "../lib/logger";
import { BotState } from "../lib/bot-state";
import { AppWrapper } from "../lib/routes";
import { ResponseLike } from "./multi";
import { Database } from "../lib/db";
import { Bot as _Bot } from './bot';
import { Auth } from "../lib/auth";
import chalk from 'chalk';

export namespace Temperature {
	type Mode = 'on'|'off'|'auto';

	namespace TempControl {	
		let target: number = 20.0;
		let mode: Mode = 'auto';
		let lastTemp: number = -1;
		let db: Database|null = null;

		export function setTarget(targetTemp: number) {
			target = targetTemp;
		}

		export function setMode(newMode: Mode) {
			mode = newMode;
		}

		export function setLastTemp(temp: number, store: boolean = true) {
			lastTemp = temp;

			// Write temp to database
			if (store) {
				const tempHistory = db!.get('history', []) as {
					date: number;
					temp: number;
				}[];
				tempHistory.push({
					date: Date.now(),
					temp: temp
				});
				db!.setVal('history', tempHistory);
			}
			
			log(getTime(), chalk.cyan('[temp]',
				chalk.bold(`Current temperature: ${temp}°`)));
		}

		export function getTarget() {
			return target;
		}

		export function getMode() {
			return mode;
		}

		export function getLastTemp() {
			return lastTemp;
		}

		export function getHeaterState() {
			if (mode === 'on') return 'on';
			if (mode === 'off') return 'off';
			if (lastTemp > target) {
				return 'on';
			}
			return 'off';
		}

		export function init(database: Database) {
			db = database;

			const target = database.get('target', 20.0);
			const temp = database.get('temp', 20.0);

			setTarget(target);
			setLastTemp(temp, false);
		}
	}

	export namespace External {
		type ExternalRequest = {
			action: 'setMode';
			mode: Mode;
		}|{
			action: 'setTarget';
			target: number;
		}|{
			action: 'getTemp';
		}

		export class Handler {
			constructor(private _logObj: any) {}

			private async _handleRequest(request: ExternalRequest) {
				const resDummy = new ResDummy();

				switch (request.action) {
					case 'getTemp':
						return API.Handler.getTemp(resDummy, {
							auth: await Auth.Secret.getKey()
						});
					case 'setMode':
						API.Handler.setMode(resDummy, {
							auth: await Auth.Secret.getKey(),
							mode: request.mode
						});
						break;
					case 'setTarget':
						API.Handler.setTargetTemp(resDummy, {
							auth: await Auth.Secret.getKey(),
							target: request.target
						});
						break;
				}
				resDummy.transferTo(this._logObj);
				return;
			}

			public setMode(mode: Mode) {
				const req: ExternalRequest = {
					action: 'setMode',
					mode
				};
				this._handleRequest(req);
			}

			public setTarget(target: number) {
				const req: ExternalRequest = {
					action: 'setTarget',
					target
				};
				this._handleRequest(req);
			}

			public getTemp() {
				const req: ExternalRequest = {
					action: 'getTemp'
				};
				return this._handleRequest(req);
			}
		}
	}

	export namespace Bot {
		export interface JSON {
		}

		export class Bot extends BotState.Base {
			static readonly commands = {
				'/temp': 'Get the current temperature',
				'/tempstate': 'Get the state of the heater',
				'/tempmode': 'Get the mode of the heater',
				'/heat': 'Start heating',
				'/heatoff': 'Stop heating',
				'/help_temperature': 'Print help commands for temperature'
			};

			static readonly botName = 'Temperature';

			
			static readonly matches = Bot.createMatchMaker(({
				matchMaker: mm
			}) => {
				mm('/temp', /what is the(current )?temp(erature)?/, /what temp(erature)? is it(\?)?/, /how (warm|cold) is it(\?)?/, async ({ logObj }) => {
					attachMessage(logObj, `Reporting temperature ${Math.round(TempControl.getLastTemp())}`);
					return Bot.makeTable({
						contents: [
							['Temp', Math.round(TempControl.getLastTemp()) + ''],
							['Heater state', TempControl.getHeaterState()],
							['Heater mode', TempControl.getMode()]
						]
					});
				});
				mm('/tempstate', /what is the (temp|temperature|heater) state/, async ({ logObj }) => {
					attachMessage(logObj, `Reporting heater state ${TempControl.getHeaterState()}`);
					return `Heater is currently ${TempControl.getHeaterState()}`;
				});
				mm('/tempmode', /what is the (temp|temperature|heater) mode/, async ({ logObj }) => {
					attachMessage(logObj, `Reporting heater mode ${TempControl.getMode()}`);
					return `Heater mode is ${TempControl.getMode()}`;
				});
				mm('/heat', /start heating/, /make it hot/, /heat/, async ({ logObj }) => {
					new External.Handler(attachMessage(logObj, 'Heating')).setMode('on');
					return 'Heating';
				});
				mm('/heatoff', /stop heating/, /make it cold/, async ({ logObj }) => {
					new External.Handler(attachMessage(logObj, 'Stopping heating')).setMode('off');
					return 'Stopping heating';
				});
				mm(/set(?: temp(?:erature)?) target to ((\d+)(\.\d+)?)/, async ({ logObj, match }) => {	
					const target = parseFloat(match[1]);
					if (Number.isNaN(target) || target === 0 || target < 0) {
						return 'Invalid target';
					}
					new External.Handler(attachMessage(logObj, `Setting temp to ${target}`)).setTarget(target);
					return `Set target to ${target}`;
				});
				
				mm('/help_temperature', /what commands are there for temperature/, async () => {
					return `Commands are:\n${Bot.matches.matches.map((match) => {
						return `RegExps: ${
							match.regexps.map(r => r.source).join(', ')}. Texts: ${
								match.texts.join(', ')}}`
					}).join('\n')}`
				});
			});

			constructor(_json?: JsonWebKey) {
				super();
			}

			static async match(config: { 
				logObj: any; 
				text: string; 
				message: _Bot.TelegramMessage; 
				state: _Bot.Message.StateKeeping.ChatState; 
			}): Promise<_Bot.Message.MatchResponse | undefined> {
				return await this.matchLines({ ...config, matchConfig: Bot.matches });
			}

			toJSON(): JSON {
				return { };
			}
		}
	}

	export namespace API {
		export class Handler {
			@errorHandle
			@requireParams('mode')
			@auth
			public static setMode(res: ResponseLike, { mode }: {
				auth?: string;
				mode: Mode;
			}) {
				const oldMode = TempControl.getMode();
				attachMessage(res, `Setting mode to ${mode} from ${oldMode}`);
				res.status(200);
				res.end();
			}

			@errorHandle
			@requireParams('target')
			@auth
			public static setTargetTemp(res: ResponseLike, { target }: {
				auth?: string;
				target: number;
			}) {
				const oldTemp = TempControl.getTarget();
				attachMessage(res, `Setting target temp to ${target} from ${oldTemp}`);
				res.status(200);
				res.end();
			}

			@errorHandle
			@authAll
			public static getTemp(res: ResponseLike, { }: {
				auth?: string;
			}) {
				attachMessage(res, `Getting temp. Returning ${TempControl.getLastTemp()}`);
				res.status(200);
				res.write(JSON.stringify({
					temp: TempControl.getLastTemp()
				}))
				res.end();
				return {
					temp: TempControl.getLastTemp()
				};
			}
		}
	}

	export namespace Routing {
		export async function init({ 
			app, db
		}: { 
			app: AppWrapper;
			db: Database;
		}) {
			TempControl.init(db);

			app.post('/temperature/target/:target?', async (req, res) => {
				API.Handler.setTargetTemp(res, {...req.params, ...req.body, cookies: req.cookies});
			});
			app.post('/temperature/mode/:mode?', async (req, res) => {
				API.Handler.setMode(res, {...req.params, ...req.body, cookies: req.cookies});
			});
			app.all('/temperature/temp', async (req, res) => {
				API.Handler.getTemp(res, {...req.params, ...req.body, cookies: req.cookies});
			});

			app.post('/temperature/advise/:temp?', async (req, res) => {
				const body = {...req.params, ...req.body};
				if (!('temp' in body)) {
					res.write(`Missing key "temp"`);
					res.status(400);
					res.end();
					return;
				}
				const temp = parseFloat(body['temp']);
				if (Number.isNaN(temp) || temp === 0) {
					res.write(`Invalid temperature "${body['temp']}"`);
					res.status(400);
					res.end();
					return;
				}
				
				// Set last temp
				TempControl.setLastTemp(temp);
				
				res.write(TempControl.getHeaterState());
				res.status(200);
				res.end();
			});
		}
	}
}