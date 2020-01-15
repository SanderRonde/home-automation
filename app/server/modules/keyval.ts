import {
	errorHandle,
	requireParams,
	auth,
	authCookie,
	authAll,
	upgradeToHTTPS
} from '../lib/decorators';
import {
	SCREEN_DEVICE_NAME,
	MAIN_LIGHTS,
	COMMON_SWITCH_MAPPINGS
} from '../lib/constants';
import {
	attachMessage,
	getLogLevel,
	ResDummy,
	getTime,
	log
} from '../lib/logger';
import { NotifyFn, AllModules, ModuleHookables } from './all';
import * as ReadLine from '@serialport/parser-readline';
import { WSSimulator, WSSimInstance } from '../lib/ws';
import { arrToObj, awaitCondition } from '../lib/util';
import groups from '../config/keyval-groups';
import aggregates from '../config/aggregates';
import { BotState } from '../lib/bot-state';
import { AppWrapper } from '../lib/routes';
import * as SerialPort from 'serialport';
import { ResponseLike } from './multi';
import { Database } from '../lib/db';
import { Bot as _Bot } from './bot';
import * as express from 'express';
import { Auth } from '../lib/auth';
import chalk from 'chalk';

export interface KeyvalHooks {
	[key: string]: {
		on?: {
			[name: string]: (hookables: ModuleHookables) => any | Promise<any>;
		};
		off?: {
			[name: string]: (hookables: ModuleHookables) => any | Promise<any>;
		};
	};
}

export const enum KEYVAL_GROUP_EFFECT {
	SAME,
	INVERT
}
export interface GroupConfig {
	[key: string]: {
		[key: string]: KEYVAL_GROUP_EFFECT;
	};
}

export namespace KeyVal {
	function str(value: any | undefined) {
		return JSON.stringify(value || null);
	}

	export namespace GetSetListener {
		const _listeners: Map<
			number,
			{
				key: string;
				listener: (value: string, logObj: any) => void;
				once: boolean;
			}
		> = new Map();
		let _lastIndex: number = 0;
		let _db: Database | null = null;

		export function setDB(db: Database) {
			_db = db;
		}

		export function addListener(
			key: string,
			listener: (value: string, logObj: any) => void,
			once: boolean = false
		) {
			const index = _lastIndex++;
			_listeners.set(index, {
				key,
				listener,
				once
			});
			return index;
		}

		export function removeListener(index: number) {
			_listeners.delete(index);
		}

		export async function triggerGroups(
			key: string,
			value: string,
			logObj: any
		) {
			if (!(key in groups)) {
				attachMessage(logObj, 'No groups');
				return;
			}

			await awaitCondition(() => !!_db, 100);

			const group = groups[key];
			for (const key in group) {
				const effect = group[key];
				await _db!.setVal(
					key,
					effect === KEYVAL_GROUP_EFFECT.SAME ? value : !value
				);
			}
		}

		export async function update(key: string, value: string, logObj: any) {
			let updated: number = 0;
			const updatedKeyParts = key.split('.');

			for (const [
				index,
				{ key: listenerKey, listener, once }
			] of _listeners) {
				const listenerParts = listenerKey.split('.');
				let next: boolean = false;
				for (
					let i = 0;
					i < Math.min(updatedKeyParts.length, listenerParts.length);
					i++
				) {
					if (updatedKeyParts[i] !== listenerParts[i]) {
						next = true;
						break;
					}
				}
				if (next) continue;

				listener(value, logObj);
				updated++;
				if (once) {
					_listeners.delete(index);
				}
			}

			await triggerGroups(
				key,
				value,
				attachMessage(logObj, 'Triggering groups')
			);

			return updated;
		}
	}

	export namespace External {
		type ExternalRequest = (
			| {
					type: 'get';
					resolver: (value: any) => void;
			  }
			| {
					type: 'set';
					value: string;
					resolver: () => void;
					update?: boolean;
			  }
		) & {
			key: string;
			logObj: any;
		};

		export class Handler {
			private static _requests: ExternalRequest[] = [];
			private static _db: Database | null = null;
			private static _apiHandler: API.Handler | null = null;

			constructor(private _logObj: any) {}

			static async init({
				db,
				apiHandler
			}: {
				db: Database;
				apiHandler: API.Handler;
			}) {
				this._db = db;
				this._apiHandler = apiHandler;
				for (const req of this._requests) {
					await this._handleRequest(req);
				}
			}

			private static async _handleRequest(request: ExternalRequest) {
				const { logObj } = request;
				const resDummy = new ResDummy();
				if (request.type === 'get') {
					const { key, resolver } = request;
					const value = await this._apiHandler!.get(resDummy, {
						key,
						auth: await Auth.Secret.getKey()
					});
					resDummy.transferTo(logObj);
					resolver(value);
				} else {
					const { key, value, resolver, update } = request;
					await this._apiHandler!.set(resDummy, {
						key,
						value,
						update,
						auth: await Auth.Secret.getKey()
					});
					resDummy.transferTo(logObj);
					resolver();
				}
			}

			async set(key: string, value: string, update: boolean = true) {
				return new Promise(resolve => {
					const req: ExternalRequest = {
						type: 'set',
						key,
						value,
						update,
						logObj: this._logObj,
						resolver: resolve
					};
					if (Handler._db) {
						Handler._handleRequest(req);
					} else {
						Handler._requests.push(req);
					}
				});
			}

			async get<V>(key: string) {
				return new Promise<V>(resolve => {
					const req: ExternalRequest = {
						type: 'get',
						key,
						logObj: this._logObj,
						resolver: resolve
					};
					if (Handler._db) {
						Handler._handleRequest(req);
					} else {
						Handler._requests.push(req);
					}
				});
			}
		}
	}

	export namespace Bot {
		export interface JSON {
			lastSubjects: string[] | null;
		}

		export class Bot extends BotState.Base {
			static readonly commands = {
				'/islighton': 'Check if the light is on',
				'/lightoff': 'Turn off the light',
				'/lighton': 'Turn on the light',
				'/help_keyval': 'Print help comands for keyval'
			};

			static readonly botName = 'Keyval';

			static readonly matches = Bot.createMatchMaker(
				({ matchMaker: mm, fallbackSetter: fallback, conditional }) => {
					mm(
						'/islighton',
						/is the light (on|off)/,
						/are the lights (on|off)/,
						async ({ match, logObj, state }) => {
							const results = (await Promise.all(
								MAIN_LIGHTS.map(light => {
									return new External.Handler(logObj).get(
										light
									);
								})
							)) as string[];

							const actualState = (() => {
								if (results.every(v => v === '1')) return 'ON';
								if (results.every(v => v === '0')) return 'OFF';
								return 'BETWEEN';
							})();

							state.keyval.lastSubjects = MAIN_LIGHTS;

							switch (actualState) {
								case 'ON':
									return !match.length || match[1] === 'on'
										? 'Yep'
										: 'Nope';
								case 'OFF':
									return match.length && match[1] === 'off'
										? 'Yep'
										: 'Nope';
								default:
									return 'Some are on some are off';
							}
						}
					);
					mm('/lighton', async ({ logObj, state }) => {
						state.keyval.lastSubjects = MAIN_LIGHTS;
						await Promise.all(
							MAIN_LIGHTS.map(light => {
								return new External.Handler(logObj).set(
									light,
									'1'
								);
							})
						);
						return `Turned ${
							MAIN_LIGHTS.length > 1 ? 'them' : 'it'
						} on`;
					});
					mm('/lightoff', async ({ logObj, state }) => {
						state.keyval.lastSubjects = MAIN_LIGHTS;
						await Promise.all(
							MAIN_LIGHTS.map(light => {
								return new External.Handler(logObj).set(
									light,
									'0'
								);
							})
						);
						return `Turned ${
							MAIN_LIGHTS.length > 1 ? 'them' : 'it'
						} off`;
					});
					for (const [reg, switchName] of COMMON_SWITCH_MAPPINGS) {
						mm(
							new RegExp('turn (on|off) ' + reg.source),
							async ({ logObj, state, match }) => {
								const keyvalState = match[1];
								state.keyval.lastSubjects = [switchName];
								await new External.Handler(logObj).set(
									switchName,
									keyvalState === 'on' ? '1' : '0'
								);
								return `Turned it ${keyvalState}`;
							}
						);
						mm(
							new RegExp('is ' + reg.source + ' (on|off)'),
							async ({ logObj, state, match }) => {
								const keyvalState = match.pop();
								state.keyval.lastSubjects = [switchName];
								const res = await new External.Handler(
									logObj
								).get(switchName);
								if ((res === '1') === (keyvalState === 'on')) {
									return 'Yep';
								} else {
									return 'Nope';
								}
							}
						);
					}
					conditional(
						mm(
							/turn (it|them) (on|off)( again)?/,
							async ({ state, logObj, match }) => {
								for (const lastSubject of state.keyval
									.lastSubjects!) {
									await new External.Handler(logObj).set(
										lastSubject,
										match[2] === 'on' ? '1' : '0'
									);
								}
								return `Turned ${match[1]} ${match[2]}`;
							}
						),
						({ state }) => {
							return state.keyval.lastSubjects !== null;
						}
					);
					mm(
						'/help_keyval',
						/what commands are there for keyval/,
						async () => {
							return `Commands are:\n${Bot.matches.matches
								.map(match => {
									return `RegExps: ${match.regexps
										.map(r => r.source)
										.join(', ')}. Texts: ${match.texts.join(
										', '
									)}}`;
								})
								.join('\n')}`;
						}
					);

					fallback(({ state }) => {
						Bot.resetState(state);
					});
				}
			);

			lastSubjects: string[] | null = null;

			constructor(json?: JSON) {
				super();
				if (json) {
					this.lastSubjects = json.lastSubjects;
				}
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

			static resetState(state: _Bot.Message.StateKeeping.ChatState) {
				state.keyval.lastSubjects = null;
			}

			toJSON(): JSON {
				return {
					lastSubjects: this.lastSubjects
				};
			}
		}
	}

	export namespace API {
		export class Handler {
			private _db: Database;

			constructor({ db }: { db: Database }) {
				this._db = db;
			}

			@errorHandle
			@requireParams('key')
			@auth
			public get(
				res: ResponseLike,
				{
					key
				}: {
					key: string;
					auth?: string;
				}
			) {
				const value = this._db.get(key, '0');
				attachMessage(res, `Key: "${key}", val: "${str(value)}"`);
				res.status(200).write(value === undefined ? '' : value);
				res.end();
				return value;
			}

			@errorHandle
			@requireParams('key')
			@auth
			public async toggle(
				res: ResponseLike,
				{
					key
				}: {
					key: string;
					auth?: string;
				}
			) {
				const original = this._db.get(key);
				const value = original === '0' ? '1' : '0';
				await this._db.setVal(key, value);
				const msg = attachMessage(
					res,
					`Toggling key: "${key}", to val: "${str(value)}"`
				);
				const nextMessage = attachMessage(
					msg,
					`"${str(original)}" -> "${str(value)}"`
				);
				const updated = await GetSetListener.update(
					key,
					value,
					attachMessage(nextMessage, 'Updates')
				);
				attachMessage(nextMessage, `Updated ${updated} listeners`);
				res.status(200).write(value);
				res.end();
				return value;
			}

			@errorHandle
			@requireParams('key', 'maxtime', 'expected')
			@auth
			public getLongPoll(
				res: ResponseLike,
				{
					key,
					expected,
					maxtime
				}: {
					key: string;
					expected: string;
					auth: string;
					maxtime: string;
				}
			) {
				const value = this._db.get(key, '0');
				if (value !== expected) {
					const msg = attachMessage(
						res,
						`Key: "${key}", val: "${str(value)}"`
					);
					attachMessage(
						msg,
						`(current) "${str(value)}" != (expected) "${expected}"`
					);
					res.status(200).write(value === undefined ? '' : value);
					res.end();
					return;
				}

				// Wait for changes to this key
				let triggered: boolean = false;
				const id = GetSetListener.addListener(
					key,
					(value, logObj) => {
						triggered = true;
						const msg = attachMessage(
							res,
							`Key: "${key}", val: "${str(value)}"`
						);
						attachMessage(
							msg,
							`Set to "${str(value)}". Expected "${expected}"`
						);
						attachMessage(
							logObj,
							`Returned longpoll with value "${value}"`
						);
						res.status(200).write(value === undefined ? '' : value);
						res.end();
					},
					true
				);
				setTimeout(() => {
					if (!triggered) {
						GetSetListener.removeListener(id);
						const value = this._db.get(key, '0');
						const msg = attachMessage(
							res,
							`Key: "${key}", val: "${str(value)}"`
						);
						attachMessage(msg, `Timeout. Expected "${expected}"`);
						res.status(200).write(value === undefined ? '' : value);
						res.end();
					}
				}, parseInt(maxtime, 10) * 1000);
			}

			@errorHandle
			@requireParams('key', 'value')
			@authAll
			public async set(
				res: ResponseLike,
				{
					key,
					value,
					update
				}: {
					key: string;
					value: string;
					auth?: string;
					update?: boolean;
				}
			) {
				const original = this._db.get(key);
				await this._db.setVal(key, value);
				const msg = attachMessage(
					res,
					`Key: "${key}", val: "${str(value)}"`
				);
				const nextMessage = attachMessage(
					msg,
					`"${str(original)}" -> "${str(value)}"`
				);
				if (update) {
					const updated = await GetSetListener.update(
						key,
						value,
						attachMessage(nextMessage, 'Updates')
					);
					attachMessage(nextMessage, `Updated ${updated} listeners`);
				}
				res.status(200).write(value);
				res.end();
			}

			@errorHandle
			@authAll
			public async all(
				res: ResponseLike,
				{
					force = false
				}: {
					force?: boolean;
				}
			) {
				const data = await this._db.json(force);
				const msg = attachMessage(res, data);
				attachMessage(msg, `Force? ${force ? 'true' : 'false'}`);
				res.status(200).write(data);
				res.end();
			}
		}
	}

	export namespace Webpage {
		async function keyvalHTML(json: string, randomNum: number) {
			return `<html style="background-color: rgb(70,70,70);">
				<head>
					<link rel="icon" href="/keyval/favicon.ico" type="image/x-icon" />
					<link rel="manifest" href="/keyval/static/manifest.json">
					<meta name="viewport" content="width=device-width, initial-scale=1">
					<title>KeyVal Switch</title>
				</head>
				<body style="margin: 0">
					<json-switches json='${json}' key="${await Auth.Secret.getKey()}"></json-switches>
					<script type="module" src="/keyval/keyval.bundle.js?n=${randomNum}"></script>
				</body>
			</html>`;
		}

		export class Handler {
			private _db: Database;
			private _randomNum: number;

			constructor({
				db,
				randomNum
			}: {
				randomNum: number;
				db: Database;
			}) {
				this._db = db;
				this._randomNum = randomNum;
			}

			@errorHandle
			@authCookie
			@upgradeToHTTPS
			public async index(res: ResponseLike, _req: express.Request) {
				res.status(200);
				res.contentType('.html');
				res.write(
					await keyvalHTML(await this._db.json(true), this._randomNum)
				);
				res.end();
			}
		}
	}

	export namespace Screen {
		export class Handler {
			private _port: SerialPort;
			// @ts-ignore
			private _parser = new ReadLine();
			private _db: Database;
			static readonly DEVICE_NAME = SCREEN_DEVICE_NAME;

			constructor({ db }: { db: Database }) {
				this._db = db;

				this._port = new SerialPort(Handler.DEVICE_NAME, {
					baudRate: 9600
				});
				this._port.on('error', e => {
					log(getTime(), chalk.red('Failed to connect to screen', e));
				});

				//@ts-ignore
				this._port.pipe(this._parser);
				this._parser.on('data', async (line: string) => {
					if (line.startsWith('#')) {
						if (getLogLevel() > 1) {
							log(
								getTime(),
								chalk.gray(`[${Handler.DEVICE_NAME}]`),
								line.slice(2)
							);
						}
						return;
					}
					const [key, value] = line.split(' ');
					log(
						getTime(),
						chalk.cyan(`[${Handler.DEVICE_NAME}]`),
						chalk.bold(line)
					);
					await this._db.setVal(key, value.trim());
					await GetSetListener.update(key, value.trim(), {});
				});

				GetSetListener.addListener(
					'room.lights.ceiling',
					(value, logObj) => {
						attachMessage(
							logObj,
							`Writing "s${value}" to screen port - screen`
						);
						this._port.write(`s${value}\n`);
					}
				);
				GetSetListener.addListener(
					'room.devices.beamer',
					(value, logObj) => {
						attachMessage(
							logObj,
							`Writing "i${value}" to screen port - IR`
						);
						this._port.write(`i${value}\n`);
					}
				);
			}
		}
	}

	export const notifyModules: NotifyFn = modules => {
		Aggregates.setModules(modules);
	};

	namespace Aggregates {
		let allModules: AllModules | null = null;
		export function setModules(modules: AllModules) {
			allModules = modules;
		}

		async function registerAggregates(db: Database) {
			for (const key in aggregates) {
				const fullName = `aggregates.${key}`;
				if ((await db.get(fullName)) === undefined) {
					await db.setVal(fullName, '0');
				}
			}
		}

		async function createHookables(logObj: any): Promise<ModuleHookables> {
			await awaitCondition(() => {
				console.log('checking condition', allModules !== null);
				return allModules !== null;
			}, 100);

			return (arrToObj(
				Object.keys(allModules!).map((name: keyof AllModules) => {
					return [
						name,
						new allModules![name].External.Handler(logObj)
					];
				})
			) as unknown) as ModuleHookables;
		}

		function registerListeners() {
			for (const key in aggregates) {
				const config = aggregates[key];
				const fullName = `aggregates.${key}`;
				GetSetListener.addListener(fullName, async (value, logObj) => {
					const handlers = (() => {
						if (value === '1') {
							return config.on;
						} else if (value === '0') {
							return config.off;
						}
						return null;
					})();
					if (!handlers) return;

					let index: number = 0;
					for (const key in handlers) {
						const fn = handlers[key];
						console.log(fn);
						debugger;
						await fn(
							await createHookables(
								attachMessage(
									logObj,
									'Aggregate',
									chalk.bold(index++ + ''),
									':',
									chalk.bold(key)
								)
							)
						);
					}
				});
			}
		}

		export async function init(db: Database) {
			await registerAggregates(db);
			registerListeners();
		}
	}

	export namespace Routing {
		type WSMessages = {
			send: 'authid' | 'authfail' | 'authsuccess' | 'valChange';
			receive: 'auth' | 'listen';
		};

		export async function init({
			app,
			websocket,
			db,
			randomNum
		}: {
			app: AppWrapper;
			websocket: WSSimulator;
			db: Database;
			randomNum: number;
		}) {
			GetSetListener.setDB(db);
			const apiHandler = new API.Handler({ db });
			const webpageHandler = new Webpage.Handler({ randomNum, db });
			new Screen.Handler({ db });
			await External.Handler.init({ db, apiHandler });
			await Aggregates.init(db);

			app.post('/keyval/all', async (req, res) => {
				await apiHandler.all(res, {
					...req.params,
					...req.body,
					cookies: req.cookies
				});
			});
			app.post('/keyval/long/:key', async (req, res) => {
				await apiHandler.getLongPoll(res, {
					...req.params,
					...req.body,
					cookies: req.cookies
				});
			});
			app.get(
				'/keyval/long/:maxtime/:auth/:key/:expected',
				async (req, res) => {
					await apiHandler.getLongPoll(res, {
						...req.params,
						...req.body,
						cookies: req.cookies
					});
				}
			);
			app.post('/keyval/:key', async (req, res) => {
				await apiHandler.get(res, {
					...req.params,
					...req.body,
					cookies: req.cookies
				});
			});
			app.post('/keyval/toggle/:key', async (req, res) => {
				await apiHandler.toggle(res, {
					...req.params,
					...req.body,
					cookies: req.cookies
				});
			});
			app.post('/keyval/:key/:value', async (req, res) => {
				await apiHandler.set(res, {
					...req.params,
					...req.body,
					cookies: req.cookies
				});
			});

			websocket.all(
				'/keyval/websocket',
				async (instance: WSSimInstance<WSMessages>) => {
					instance.listen(
						'listen',
						key => {
							let lastVal: string | undefined = undefined;
							const onChange = (_value: string, logObj: any) => {
								const val = db.get(key, '0');
								if (val !== lastVal) {
									lastVal = val;
									attachMessage(
										logObj,
										`Sending "${val}" to`,
										chalk.bold(instance.ip)
									);
									instance.send('valChange', val);
								}
							};
							const listener = GetSetListener.addListener(
								key,
								onChange
							);
							onChange('0', {});

							instance.onClose = () => {
								GetSetListener.removeListener(listener);
							};
						},
						instance.ip
					);
				}
			);

			app.all('/keyval', async (req, res) => {
				await webpageHandler.index(res, req);
			});
		}
	}
}
