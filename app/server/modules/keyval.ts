import {
	errorHandle,
	requireParams,
	auth,
	authCookie,
	authAll,
	upgradeToHTTPS
} from '../lib/decorators';
import { MAIN_LIGHTS, COMMON_SWITCH_MAPPINGS } from '../lib/constants';
import {
	attachMessage,
	ResDummy,
	getTime,
	log,
	attachSourcedMessage
} from '../lib/logger';
import { AllModules, ModuleHookables, ModuleConfig } from './modules';
import { arrToObj, awaitCondition } from '../lib/util';
import aggregates from '../config/aggregates';
import groups from '../config/keyval-groups';
import { BotState } from '../lib/bot-state';
import { WSSimInstance } from '../lib/ws';
import { ExplainHook } from './explain';
import { ResponseLike } from './multi';
import { Database } from '../lib/db';
import { Bot as _Bot } from './bot';
import * as express from 'express';
import { ModuleMeta } from './meta';
import { Auth } from './auth';
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
	export const meta = new (class Meta extends ModuleMeta {
		name = 'keyval';

		async init(config: ModuleConfig) {
			const { db } = config;
			GetSetListener.setDB(db);
			const apiHandler = new API.Handler({ db });
			await External.Handler.init({ db, apiHandler });
			await Aggregates.init(db);

			await Routing.init({ ...config, apiHandler });
		}

		async notifyModules(modules: AllModules) {
			Aggregates.setModules(modules);
		}

		get external() {
			return External;
		}

		get bot() {
			return Bot;
		}

		addExplainHook(hook: ExplainHook) {
			API.initExplainHook(hook);
		}
	})();

	function str(value: any | undefined) {
		return JSON.stringify(value || null);
	}

	export namespace GetSetListener {
		const _listeners: Map<
			number,
			{
				key: string;
				listener: (value: string, logObj: any) => void | Promise<void>;
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
				const opposite = value === '1' ? '0' : '1';
				const effect = group[key];
				await _db!.setVal(
					key,
					effect === KEYVAL_GROUP_EFFECT.SAME ? value : opposite
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

				await listener(value, logObj);
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
			source: string;
		};

		export class Handler {
			private static _requests: ExternalRequest[] = [];
			private static _db: Database | null = null;
			private static _apiHandler: API.Handler | null = null;

			constructor(private _logObj: any, private _source: string) {}

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
					const value = this._apiHandler!.get(resDummy, {
						key,
						auth: Auth.Secret.getKey()
					});

					resDummy.transferTo(logObj);
					resolver(value);
				} else {
					const { key, value, resolver, update, source } = request;

					await this._apiHandler!.set(
						resDummy,
						{
							key,
							value,
							update,
							auth: Auth.Secret.getKey()
						},
						source
					);

					resDummy.transferTo(logObj);
					resolver();
				}
			}

			async set(key: string, value: string, notify: boolean = true) {
				return new Promise(resolve => {
					const req: ExternalRequest = {
						type: 'set',
						key,
						value,
						update: notify,
						logObj: this._logObj,
						source: this._source,
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
						source: this._source,
						resolver: resolve
					};
					if (Handler._db) {
						Handler._handleRequest(req);
					} else {
						Handler._requests.push(req);
					}
				});
			}

			async toggle(key: string) {
				const value = await this.get(key);
				const newValue = value === '1' ? '0' : '1';
				await this.set(key, newValue);
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
						async ({ match, logObj, state, matchText }) => {
							const results = (await Promise.all(
								MAIN_LIGHTS.map(light => {
									return new External.Handler(
										logObj,
										`BOT.${matchText}`
									).get(light);
								})
							)) as string[];

							const actualState = (() => {
								if (results.every(v => v === '1')) return 'ON';
								if (results.every(v => v === '0')) return 'OFF';
								return 'BETWEEN';
							})();

							state.states.keyval.lastSubjects = MAIN_LIGHTS;

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
					mm('/lighton', async ({ logObj, state, matchText }) => {
						state.states.keyval.lastSubjects = MAIN_LIGHTS;
						await Promise.all(
							MAIN_LIGHTS.map(light => {
								return new External.Handler(
									logObj,
									`BOT.${matchText}`
								).set(light, '1');
							})
						);
						return `Turned ${
							MAIN_LIGHTS.length > 1 ? 'them' : 'it'
						} on`;
					});
					mm('/lightoff', async ({ logObj, state, matchText }) => {
						state.states.keyval.lastSubjects = MAIN_LIGHTS;
						await Promise.all(
							MAIN_LIGHTS.map(light => {
								return new External.Handler(
									logObj,
									`BOT.${matchText}`
								).set(light, '0');
							})
						);
						return `Turned ${
							MAIN_LIGHTS.length > 1 ? 'them' : 'it'
						} off`;
					});
					for (const [reg, switchName] of COMMON_SWITCH_MAPPINGS) {
						mm(
							new RegExp('turn (on|off) ' + reg.source),
							async ({ logObj, state, match, matchText }) => {
								const keyvalState = match[1];
								state.states.keyval.lastSubjects = [switchName];
								await new External.Handler(
									logObj,
									`BOT.${matchText}`
								).set(
									switchName,
									keyvalState === 'on' ? '1' : '0'
								);
								return `Turned it ${keyvalState}`;
							}
						);
						mm(
							new RegExp('is ' + reg.source + ' (on|off)'),
							async ({ logObj, state, match, matchText }) => {
								const keyvalState = match.pop();
								state.states.keyval.lastSubjects = [switchName];
								const res = await new External.Handler(
									logObj,
									`BOT.${matchText}`
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
							async ({ state, logObj, match, matchText }) => {
								for (const lastSubject of state.states.keyval
									.lastSubjects!) {
									await new External.Handler(
										logObj,
										`BOT.${matchText}`
									).set(
										lastSubject,
										match[2] === 'on' ? '1' : '0'
									);
								}
								return `Turned ${match[1]} ${match[2]}`;
							}
						),
						({ state }) => {
							return state.states.keyval.lastSubjects !== null;
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

			static async match(
				config: _Bot.Message.MatchParameters
			): Promise<_Bot.Message.MatchResponse | undefined> {
				return await this.matchLines({
					...config,
					matchConfig: Bot.matches
				});
			}

			static resetState(state: _Bot.Message.StateKeeping.ChatState) {
				state.states.keyval.lastSubjects = null;
			}

			toJSON(): JSON {
				return {
					lastSubjects: this.lastSubjects
				};
			}
		}
	}

	export namespace API {
		let explainHook: ExplainHook | null = null;

		export function initExplainHook(hook: ExplainHook) {
			explainHook = hook;
		}

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
				},
				source: string
			) {
				const original = this._db.get(key);
				const value = original === '0' ? '1' : '0';
				await this._db.setVal(key, value);
				const msg = attachSourcedMessage(
					res,
					source,
					explainHook,
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
					update = true
				}: {
					key: string;
					value: string;
					auth?: string;
					update?: boolean;
				},
				source: string
			) {
				const original = this._db.get(key);
				await this._db.setVal(key, value);
				const msg = attachSourcedMessage(
					res,
					source,
					explainHook,
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
				return;
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
		function keyvalHTML(json: string, randomNum: number) {
			return `<!DOCTYPE HTML>
			<html lang="en" style="background-color: rgb(70,70,70);">
				<head>
					<link rel="icon" href="/keyval/favicon.ico" type="image/x-icon" />
					<link rel="manifest" href="/keyval/static/manifest.json">
					<link rel="apple-touch-icon" href="/keyval/static/apple-touch-icon.png">
					<meta name="description" content="An app for controlling keyval entries">
					<meta name="viewport" content="width=device-width, initial-scale=1">
					<title>KeyVal Switch</title>
				</head>
				<body style="margin: 0;overflow-x: hidden;">
					<json-switches json='${json}' key="${Auth.Secret.getKey()}">Javascript should be enabled</json-switches>
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
					keyvalHTML(await this._db.json(true), this._randomNum)
				);
				res.end();
			}
		}
	}

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

		async function createHookables(
			key: string,
			logObj: any
		): Promise<ModuleHookables> {
			await awaitCondition(() => {
				return allModules !== null;
			}, 100);

			return (arrToObj(
				Object.keys(allModules!).map((name: keyof AllModules) => {
					return [
						name,
						new allModules![name].meta.external.Handler(
							logObj,
							`AGGREGATE.${key}`
						)
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
						await fn(
							await createHookables(
								key,
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
			receive: 'auth' | 'listen' | 'button';
		};

		export async function init({
			app,
			db,
			randomNum,
			apiHandler,
			websocketSim
		}: ModuleConfig & { apiHandler: API.Handler }) {
			const webpageHandler = new Webpage.Handler({ randomNum, db });

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
				await apiHandler.toggle(
					res,
					{
						...req.params,
						...req.body,
						cookies: req.cookies
					},
					`API.${req.url}`
				);
			});
			app.post('/keyval/:key/:value', async (req, res) => {
				await apiHandler.set(
					res,
					{
						...req.params,
						...req.body,
						cookies: req.cookies
					},
					`API.${req.url}`
				);
			});

			websocketSim.all(
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
					instance.listen(
						'button',
						async data => {
							log(
								getTime(),
								chalk.cyan(`[touch-screen]`),
								chalk.bold(data)
							);
							const [key, value] = data.split(' ');
							await db.setVal(key, value.trim());
							await GetSetListener.update(key, value.trim(), {});
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
