import {
	errorHandle,
	requireParams,
	authCookie,
	authAll,
	upgradeToHTTPS
} from '../lib/decorators';
import { remoteControlHTML } from '../templates/remote-control-template';
import { attachMessage, logTag, ResponseLike } from '../lib/logger';
import telnet_client, * as TelnetClient from 'telnet-client';
import { BotState } from '../lib/bot-state';
import { ModuleConfig } from './modules';
import { ModuleMeta } from './meta';
import { Bot as _Bot } from './bot';
import * as express from 'express';
import { getEnv } from '../lib/io';
import { Auth } from './auth';
import chalk from 'chalk';
import { createExternalClass } from '../lib/external';
import { createAPIHandler } from '../lib/api';

export namespace RemoteControl {
	export const meta = new (class Meta extends ModuleMeta {
		name = 'remote-control';

		async init(config: ModuleConfig) {
			Routing.init(config);
		}

		get external() {
			return External;
		}

		get bot() {
			return Bot;
		}
	})();

	type Commands =
		| {
				action: 'play' | 'pause' | 'playpause' | 'close';
		  }
		| {
				action: 'volumeUp' | 'volumeDown';
				amount?: number;
		  }
		| {
				action: 'setVolume';
				amount: number;
		  };

	export namespace External {
		export class Handler extends createExternalClass(false) {
			public play() {
				return this.runRequest(res => {
					return API.Handler.play(res, {
						auth: Auth.Secret.getKey()
					});
				});
			}

			public pause() {
				return this.runRequest(res => {
					return API.Handler.pause(res, {
						auth: Auth.Secret.getKey()
					});
				});
			}

			public playpause() {
				return this.runRequest(res => {
					return API.Handler.playpause(res, {
						auth: Auth.Secret.getKey()
					});
				});
			}

			public close() {
				return this.runRequest(res => {
					return API.Handler.close(res, {
						auth: Auth.Secret.getKey()
					});
				});
			}

			public volumeUp(amount: number = 10) {
				return this.runRequest(res => {
					return API.Handler.volumeUp(res, {
						auth: Auth.Secret.getKey(),
						amount
					});
				});
			}

			public volumeDown(amount: number = 10) {
				return this.runRequest(res => {
					return API.Handler.volumeDown(res, {
						auth: Auth.Secret.getKey(),
						amount
					});
				});
			}

			async setVolume(amount: number) {
				return this.runRequest(res => {
					return API.Handler.setVolume(res, {
						auth: Auth.Secret.getKey(),
						amount
					});
				});
			}
		}
	}

	export namespace GetSetListener {
		const _listeners: Map<
			number,
			(
				| {
						key: string;
						any?: boolean;
				  }
				| {
						any: true;
						key?: string;
				  }
			) & {
				listener: (
					command: Commands,
					logObj: any
				) => Promise<void> | void;
				once: boolean;
			}
		> = new Map();
		let _lastIndex: number = 0;

		export function addListener(
			command: Commands,
			listener: (command: Commands, logObj: any) => void,
			once: boolean = false
		) {
			const index = _lastIndex++;
			_listeners.set(index, {
				key: command['action'],
				listener,
				once,
				any: false
			});
			return index;
		}

		export function listenAny(
			listener: (command: Commands, logObj: any) => void,
			once: boolean = false
		) {
			const index = _lastIndex++;
			_listeners.set(index, {
				any: true,
				listener,
				once,
				key: ''
			});
			return index;
		}

		export function removeListener(index: number) {
			_listeners.delete(index);
		}

		export async function update(command: Commands, logObj: any) {
			let updated: number = 0;
			const updatedKeyParts = command['action'].split('.');

			const promises: Promise<any>[] = [];
			_listeners.forEach(
				({ any, key: listenerKey, listener, once }, index) => {
					promises.push(
						(async () => {
							if (!any) {
								const listenerParts = listenerKey!.split('.');
								let next: boolean = false;
								for (
									let i = 0;
									i <
									Math.min(
										updatedKeyParts.length,
										listenerParts.length
									);
									i++
								) {
									if (
										updatedKeyParts[i] !== listenerParts[i]
									) {
										next = true;
										break;
									}
								}
								if (next) {
									return;
								}
							}

							await listener(command, logObj);
							updated++;
							if (once) {
								_listeners.delete(index);
							}
						})()
					);
				}
			);
			await Promise.all(promises);
			return updated;
		}
	}

	export namespace Bot {
		export interface JSON {}

		export class Bot extends BotState.Base {
			static readonly commands = {};

			static readonly botName = 'RemoteControl';

			static readonly matches = Bot.createMatchMaker(
				({ matchMaker: mm }) => {
					mm(
						/play( (music|netflix|youtube|vlc|movie))?/,
						async ({ logObj }) => {
							new External.Handler(
								attachMessage(logObj, 'Playing'),
								'REMOTE_CONTROL.BOT'
							).play();
							return 'Playing';
						}
					);
					mm(
						/pause( (music|netflix|youtube|vlc|movie))?/,
						async ({ logObj }) => {
							new External.Handler(
								attachMessage(logObj, 'Pausing'),
								'REMOTE_CONTROL.BOT'
							).play();
							return 'Pausing';
						}
					);
					mm(
						/playpause( (music|netflix|youtube|vlc|movie))?/,
						async ({ logObj }) => {
							new External.Handler(
								attachMessage(logObj, 'Playpausing'),
								'REMOTE_CONTROL.BOT'
							).play();
							return 'Playpausing';
						}
					);
					mm(
						/close( (music|netflix|youtube|vlc|movie))?/,
						async ({ logObj }) => {
							new External.Handler(
								attachMessage(logObj, 'Closing'),
								'REMOTE_CONTROL.BOT'
							).play();
							return 'Closing';
						}
					);

					mm(
						/(?:increase|up) volume( by (\d+))?/,
						async ({ logObj, match }) => {
							new External.Handler(
								attachMessage(logObj, 'Increasing Volume'),
								'REMOTE_CONTROL.BOT'
							).volumeUp(
								match[1] ? parseInt(match[1], 10) : undefined
							);
							return 'Increasing Volume';
						}
					);
					mm(
						/(?:decrease|reduce|down) volume( by (\d+))?/,
						async ({ logObj, match }) => {
							new External.Handler(
								attachMessage(logObj, 'Decreasing Volume'),
								'REMOTE_CONTROL.BOT'
							).volumeUp(
								match[1] ? parseInt(match[1], 10) : undefined
							);
							return 'Decreasing Volume';
						}
					);

					mm(/set volume to (\d+)/, async ({ logObj, match }) => {
						new External.Handler(
							attachMessage(logObj, 'Setting Volume'),
							'REMOTE_CONTROL.BOT'
						).setVolume(parseInt(match[1], 10));
						return 'Setting Volume';
					});

					mm(
						'/help_remote_control',
						/what commands are there for remote-control/,
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
				}
			);

			constructor(_json?: JsonWebKey) {
				super();
			}

			static async match(
				config: _Bot.Message.MatchParameters
			): Promise<_Bot.Message.MatchResponse | undefined> {
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
			@errorHandle
			@authAll
			public static async play(
				res: ResponseLike,
				{}: {
					auth?: string;
				}
			) {
				const msg = attachMessage(res, `Command: "play"`);
				await GetSetListener.update(
					{
						action: 'play'
					},
					attachMessage(msg, 'Updates')
				);
				res.status(200);
				res.end();
			}

			@errorHandle
			@authAll
			public static pause(
				res: ResponseLike,
				{}: {
					auth?: string;
				}
			) {
				const msg = attachMessage(res, `Command: "pause"`);
				GetSetListener.update(
					{
						action: 'pause'
					},
					attachMessage(msg, 'Updates')
				);
				res.status(200);
				res.end();
			}

			@errorHandle
			@authAll
			public static playpause(
				res: ResponseLike,
				{}: {
					auth?: string;
				}
			) {
				const msg = attachMessage(res, `Command: "playpause"`);
				GetSetListener.update(
					{
						action: 'playpause'
					},
					attachMessage(msg, 'Updates')
				);
				res.status(200);
				res.end();
			}

			@errorHandle
			@authAll
			public static close(
				res: ResponseLike,
				{}: {
					auth?: string;
				}
			) {
				const msg = attachMessage(res, `Command: "close"`);
				GetSetListener.update(
					{
						action: 'close'
					},
					attachMessage(msg, 'Updates')
				);
				res.status(200);
				res.end();
			}

			@errorHandle
			@authAll
			public static volumeUp(
				res: ResponseLike,
				{
					amount = 10
				}: {
					auth?: string;
					amount?: number;
				}
			) {
				const msg = attachMessage(
					res,
					`Command: "volumeUp", amount: "${amount}"`
				);
				GetSetListener.update(
					{
						action: 'volumeUp',
						amount: amount
					},
					attachMessage(msg, 'Updates')
				);
				res.status(200);
				res.end();
			}

			@errorHandle
			@authAll
			public static volumeDown(
				res: ResponseLike,
				{
					amount = 10
				}: {
					auth?: string;
					amount?: number;
				}
			) {
				const msg = attachMessage(
					res,
					`Command: "volumeDown", amount: "${amount}"`
				);
				GetSetListener.update(
					{
						action: 'volumeDown',
						amount: amount
					},
					attachMessage(msg, 'Updates')
				);
				res.status(200);
				res.end();
			}

			@errorHandle
			@requireParams('amount')
			@authAll
			public static setVolume(
				res: ResponseLike,
				{
					amount
				}: {
					auth?: string;
					amount: number;
				}
			) {
				const msg = attachMessage(
					res,
					`Command: "setVolume", amount: "${amount}"`
				);
				GetSetListener.update(
					{
						action: 'setVolume',
						amount
					},
					attachMessage(msg, 'Updates')
				);
				res.status(200);
				res.end();
			}
		}
	}

	export namespace Webpage {
		export class Handler {
			constructor(private _randomNum: number) {}

			@errorHandle
			@authCookie
			@upgradeToHTTPS
			public async index(res: ResponseLike, _req: express.Request) {
				res.status(200);
				res.contentType('.html');
				res.write(remoteControlHTML(this._randomNum));
				res.end();
			}
		}
	}

	export namespace Routing {
		export namespace Telnet {
			let TELNET_IPS: [string, string, string][] | null;
			const connections: Map<
				string,
				{
					host: string;
					conn: telnet_client;
				}
			> = new Map();

			async function* getClients() {
				const preConnectVals = connections.values();

				const prom = Promise.all(
					TELNET_IPS!.map(async ([host, port, password]) => {
						if (connections.has(host)) {
							return;
						}

						const conn = new ((TelnetClient as unknown) as typeof telnet_client)();
						try {
							await conn.connect({
								host,
								port: parseInt(port, 10),
								password: password,
								debug: true,
								timeout: 1500,
								shellPrompt: '> ',
								username: '',
								initialLFCR: true
							});
							logTag(
								'telnet',
								'cyan',
								chalk.bold(`Connected to host ${host}`)
							);
							connections.set(host, {
								host,
								conn
							});
							return {
								host,
								conn
							};
						} catch (err) {
							return;
						}
					})
				);

				for (const client of preConnectVals) {
					yield client;
				}

				for (const newConnection of await prom) {
					if (newConnection) {
						yield newConnection;
					}
				}
			}

			async function executeTelnetCommand(
				conn: telnet_client,
				command: Commands
			) {
				switch (command.action) {
					case 'close':
						return conn.send('quit');
					case 'pause':
						return conn.send('pause');
					case 'play':
						return conn.send('play');
					case 'playpause':
						const isPlaying = await conn.send('is_playing');
						return conn.send(isPlaying === '1' ? 'pause' : 'play');
					case 'setVolume':
						return conn.send(`volume ${command.amount * 2.56}`);
					case 'volumeUp':
						const vol1 = parseInt(
							await conn.send('volume', {
								waitfor: /\d+/
							}),
							10
						);
						return conn.send(
							`volume ${Math.min(
								320,
								vol1 + (command.amount || 10) * 2.56
							)}`
						);
					case 'volumeDown':
						const vol2 = parseInt(
							await conn.send('volume', {
								waitfor: /\d+/
							}),
							10
						);
						return conn.send(
							`volume ${Math.max(
								0,
								vol2 - (command.amount || 10) * 2.56
							)}`
						);
				}
			}

			export async function sendMessage(command: Commands, logObj: any) {
				const gen = getClients();
				let next: IteratorResult<
					{
						host: string;
						conn: telnet_client;
					},
					void
				> | null = null;
				while ((next = await gen.next()) && !next.done) {
					(async () => {
						try {
							attachMessage(
								logObj,
								`Executing telnet command: ${JSON.stringify(
									command
								)} on host ${next.value.host}`
							);
							await executeTelnetCommand(
								next.value.conn,
								command
							);
						} catch (e) {
							attachMessage(
								logObj,
								`Failed Executing telnet command: ${JSON.stringify(
									command
								)} on host ${next.value.host}`
							);
							// Remove connection
							connections.delete(next.value.host);
						}
					})();
				}
			}

			(async () => {
				TELNET_IPS = getEnv('SECRET_REMOTE_CONTROL', true)
					.split('\n')
					.filter(l => l.length)
					.map(l => l.split(':')) as [string, string, string][];
			})();
		}

		export async function init({
			app,
			randomNum,
			websocket
		}: ModuleConfig) {
			const webpageHandler = new Webpage.Handler(randomNum);

			app.post(
				'/remote-control/play',
				createAPIHandler(RemoteControl, API.Handler.play)
			);
			app.post(
				'/remote-control/pause',
				createAPIHandler(RemoteControl, API.Handler.pause)
			);
			app.post(
				'/remote-control/playpause',
				createAPIHandler(RemoteControl, API.Handler.playpause)
			);
			app.post(
				'/remote-control/close',
				createAPIHandler(RemoteControl, API.Handler.close)
			);

			app.post(
				'/remote-control/volumeup/:amount?',
				createAPIHandler(RemoteControl, API.Handler.volumeUp)
			);
			app.post(
				'/remote-control/volumedown/:amount?',
				createAPIHandler(RemoteControl, API.Handler.volumeDown)
			);

			app.post(
				'/remote-control/setvolume/:amount',
				createAPIHandler(RemoteControl, API.Handler.setVolume)
			);

			websocket.all(
				'/remote-control/listen',
				async ({ send, onDead, addListener }) => {
					let authenticated: boolean = false;
					addListener(message => {
						if (authenticated) return;

						if (Auth.Secret.authenticate(message)) {
							authenticated = true;

							const listener = GetSetListener.listenAny(
								(command, logObj) => {
									attachMessage(
										logObj,
										`Sending remote control message`
									);
									send(JSON.stringify(command));
								}
							);

							onDead(() => {
								GetSetListener.removeListener(listener);
							});
						}
					});
				}
			);

			// Update any VLC telnet instances on change
			GetSetListener.listenAny(async (command, logObj) => {
				attachMessage(
					logObj,
					`Sending vlc telnet remote control message`
				);
				await Telnet.sendMessage(command, logObj);
			});

			app.all('/remote-control', async (req, res) => {
				await webpageHandler.index(res, req);
			});
		}
	}
}
