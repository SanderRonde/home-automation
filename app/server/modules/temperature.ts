import { errorHandle, requireParams, authAll, auth } from '../lib/decorators';
import { attachMessage, ResDummy, log, getTime } from '../lib/logger';
import { BotState } from '../lib/bot-state';
import { ResponseLike } from './multi';
import { ModuleConfig } from './modules';
import { Database } from '../lib/db';
import { Bot as _Bot } from './bot';
import { KeyVal } from './keyval';
import { Auth } from './auth';
import { ModuleMeta } from './meta';
import chalk from 'chalk';

const LOG_INTERVAL_SECS = 60;

export namespace Temperature {
	export const meta = new (class Meta extends ModuleMeta {
		name = 'temperature';

		async init(config: ModuleConfig) {
			TempControllers.init(config.db);

			await Routing.init(config);
		}

		get external() {
			return External;
		}

		get bot() {
			return Bot;
		}
	})();

	type Mode = 'on' | 'off' | 'auto';

	namespace TempControllers {
		let db: Database | null = null;
		const controllers: Map<string, TempControl> = new Map();

		export async function getController(name: string = 'default') {
			if (!controllers.has(name)) {
				controllers.set(name, await new TempControl().init(db!, name));
			}

			return controllers.get(name)!;
		}

		export function init(_db: Database) {
			db = _db;
		}

		export function getAll() {
			return Array.from(controllers.values());
		}
	}

	class TempControl {
		target: number = 20.0;
		mode: Mode = 'auto';
		lastTemp: number = -1;
		db: Database | null = null;
		lastLogTime: number = 0;
		lastLoggedTemp: number = -1;
		name!: string;

		async setTarget(targetTemp: number) {
			await this.db!.setVal(`${this.name}.target`, targetTemp);
			this.target = targetTemp;
		}

		async setMode(newMode: Mode) {
			await this.db!.setVal(`${this.name}.mode`, newMode);
			this.mode = newMode;

			if (newMode === 'off') {
				new KeyVal.External.Handler({}, 'HEATING.off').set(
					'room.heating',
					'0',
					false
				);
			} else {
				new KeyVal.External.Handler({}, 'HEATING.on').set(
					'room.heating',
					'1',
					false
				);
			}
		}

		async setLastTemp(
			temp: number,
			store: boolean = true,
			doLog: boolean = true
		) {
			this.lastTemp = temp;

			// Write temp to database
			if (store) {
				const tempHistory = JSON.parse(
					JSON.stringify(
						this.db!.get(`${this.name}.history`, []) as {
							date: number;
							temp: number;
							state?: 'on' | 'off';
						}[]
					)
				);
				tempHistory.push({
					date: Date.now(),
					temp: temp,
					state: this.getHeaterState()
				});
				await this.db!.setVal(`${this.name}.history`, tempHistory);
				await this.db!.setVal(`${this.name}.temp`, temp);
			}

			if (
				doLog &&
				Math.round(this.lastLoggedTemp) != Math.round(temp) &&
				Date.now() - this.lastLogTime > LOG_INTERVAL_SECS * 1000
			) {
				log(
					getTime(),
					chalk.cyan(
						'[temp]',
						chalk.bold(`Current ${this.name} temperature: ${temp}°`)
					)
				);
				this.lastLogTime = Date.now();
			}
		}

		getTarget() {
			return this.target;
		}

		getMode() {
			return this.mode;
		}

		getLastTemp() {
			return this.lastTemp;
		}

		getHeaterState() {
			if (this.mode !== 'auto') return this.mode;
			if (this.lastTemp > this.target) {
				return 'off';
			}
			return 'on';
		}

		async init(database: Database, name: string) {
			this.db = database;
			this.name = name;

			const target = database.get(`${name}.target`, 20.0);
			const prevMode = database.get(`${name}.mode`, 'auto');
			const temp = database.get(`${name}.temp`, 20.0);

			await this.setTarget(target);
			await this.setMode(prevMode);
			await this.setLastTemp(temp, false, false);

			return this;
		}
	}

	export namespace External {
		type ExternalRequest =
			| {
					action: 'setMode';
					mode: Mode;
					name: string;
			  }
			| {
					action: 'setTarget';
					target: number;
					name: string;
			  }
			| {
					action: 'getTemp';
					name: string;
			  };

		export class Handler {
			constructor(private _logObj: any) {}

			private async _handleRequest(request: ExternalRequest) {
				const resDummy = new ResDummy();

				switch (request.action) {
					case 'getTemp':
						return API.Handler.getTemp(resDummy, {
							auth: Auth.Secret.getKey(),
							name: request.name
						});
					case 'setMode':
						await API.Handler.setMode(resDummy, {
							auth: Auth.Secret.getKey(),
							mode: request.mode,
							name: request.name
						});
						break;
					case 'setTarget':
						await API.Handler.setTargetTemp(resDummy, {
							auth: Auth.Secret.getKey(),
							target: request.target,
							name: request.name
						});
						break;
				}
				resDummy.transferTo(this._logObj);
				return;
			}

			public setMode(name: string, mode: Mode) {
				const req: ExternalRequest = {
					action: 'setMode',
					mode,
					name
				};
				this._handleRequest(req);
			}

			public setTarget(name: string, target: number) {
				const req: ExternalRequest = {
					action: 'setTarget',
					target,
					name
				};
				this._handleRequest(req);
			}

			public getTemp(name: string) {
				const req: ExternalRequest = {
					action: 'getTemp',
					name
				};
				return this._handleRequest(req);
			}
		}
	}

	export namespace Bot {
		export interface JSON {}

		export class Bot extends BotState.Base {
			static readonly commands = {
				'/temp': 'Get the current temperature',
				'/heat': 'Start heating',
				'/heatoff': 'Stop heating',
				'/heatauto': 'Set heat mode to auto',
				'/help_temperature': 'Print help commands for temperature'
			};

			static readonly botName = 'Temperature';

			static readonly matches = Bot.createMatchMaker(
				({ matchMaker: mm }) => {
					mm(
						'/temp',
						/what (is|are) the(current )?temp(erature)?(s)?/,
						/what temp(erature)? is it(\?)?/,
						/how (warm|cold) is it(\?)?/,
						async ({ logObj }) => {
							attachMessage(
								logObj,
								`Reporting temperatures ${TempControllers.getAll().map(
									controller => {
										return Math.round(
											controller.getLastTemp()
										);
									}
								)}`
							);
							const contents = [];
							for (const controller of TempControllers.getAll()) {
								contents.push(
									...[
										['Name', controller.name],
										[
											'Temp',
											Math.round(
												controller.getLastTemp() * 10
											) /
												10 +
												''
										],
										[
											'Heater state',
											controller.getHeaterState()
										],
										['Heater mode', controller.getMode()],
										[
											'Target temperature',
											controller.getTarget() + ''
										]
									]
								);
							}

							return Bot.makeTable({
								contents: contents
							});
						}
					);
					mm(
						'/heatoff',
						/stop heating/,
						/make it cold/,
						async ({ logObj }) => {
							new External.Handler(
								attachMessage(logObj, 'Stopping heating')
							).setMode('default', 'off');
							return 'Stopping heating';
						}
					);
					mm('/heatauto', async ({ logObj }) => {
						new External.Handler(
							attachMessage(logObj, 'Set heat mode to auto')
						).setMode('default', 'auto');
						return 'Set heat mode to auto';
					});
					mm(
						'/heat',
						/start heating/,
						/make it hot/,
						/heat/,
						async ({ logObj }) => {
							new External.Handler(
								attachMessage(logObj, 'Heating')
							).setMode('default', 'on');
							return 'Heating';
						}
					);
					mm(
						/set(?: temp(?:erature)?) mode to (\w+)/,
						async ({ logObj, match }) => {
							const mode = match[1];
							if (['on', 'off', 'auto'].indexOf(mode) === -1) {
								return 'Invalid mode';
							}
							new External.Handler(
								attachMessage(logObj, `Setting mode to ${mode}`)
							).setMode('default', mode as Mode);
							return `Set mode to ${mode}`;
						}
					);
					mm(
						/set(?: temp(?:erature)?) target to ((\d+)(\.\d+)?)/,
						async ({ logObj, match }) => {
							const target = parseFloat(match[1]);
							if (
								Number.isNaN(target) ||
								target === 0 ||
								target < 0
							) {
								return 'Invalid target';
							}
							new External.Handler(
								attachMessage(
									logObj,
									`Setting temp to ${target}`
								)
							).setTarget('default', target);
							return `Set target to ${target}`;
						}
					);

					mm(
						'/help_temperature',
						/what commands are there for temperature/,
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
			@errorHandle
			@requireParams('mode', 'name')
			@auth
			public static async setMode(
				res: ResponseLike,
				{
					mode,
					name
				}: {
					auth?: string;
					mode: Mode;
					name: string;
				}
			) {
				const controller = await TempControllers.getController(name);
				const oldMode = controller.getMode();
				attachMessage(res, `Setting mode to ${mode} from ${oldMode}`);
				await controller.setMode(mode);
				res.status(200);
				res.end();
			}

			@errorHandle
			@requireParams('target', 'name')
			@auth
			public static async setTargetTemp(
				res: ResponseLike,
				{
					target,
					name
				}: {
					auth?: string;
					target: number;
					name: string;
				}
			) {
				const controller = await TempControllers.getController(name);
				const oldTemp = controller.getTarget();
				attachMessage(
					res,
					`Setting target temp to ${target} from ${oldTemp}`
				);
				await controller.setTarget(target);
				res.status(200);
				res.end();
			}

			@errorHandle
			@authAll
			public static async getTemp(
				res: ResponseLike,
				{
					name
				}: {
					auth?: string;
					name: string;
				}
			) {
				const controller = await TempControllers.getController(name);
				attachMessage(
					res,
					`Getting temp. Returning ${controller.getLastTemp()}`
				);
				res.status(200);
				res.write(
					JSON.stringify({
						temp: controller.getLastTemp()
					})
				);
				res.end();
				return {
					temp: controller.getLastTemp()
				};
			}
		}
	}

	export namespace Routing {
		export async function init({ app }: ModuleConfig) {
			app.post('/temperature/target/:target?', async (req, res) => {
				await API.Handler.setTargetTemp(res, {
					...req.params,
					...req.body,
					cookies: req.cookies
				});
			});
			app.post('/temperature/mode/:mode?', async (req, res) => {
				await API.Handler.setMode(res, {
					...req.params,
					...req.body,
					cookies: req.cookies
				});
			});
			app.all('/temperature/temp', async (req, res) => {
				API.Handler.getTemp(res, {
					...req.params,
					...req.body,
					cookies: req.cookies
				});
			});

			app.post('/temperature/report/:name/:temp?', async (req, res) => {
				const body = { ...req.params, ...req.body };
				if (!('temp' in body)) {
					res.write(`Missing key "temp"`);
					res.status(400);
					res.end();
					return;
				}
				if (!('name' in body)) {
					res.write(`Missing key "name"`);
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
				const controller = await TempControllers.getController(
					body['name']
				);
				await controller.setLastTemp(temp);

				attachMessage(
					res,
					`Reported temperature: "${controller.getLastTemp()}`
				);
				res.status(200);
				res.end();
			});

			app.post('/temperature/advise/:temp?', async (req, res) => {
				const body = { ...req.params, ...req.body };
				if (!('temp' in body)) {
					res.write(`Missing key "temp"`);
					res.status(400);
					res.end();
					return;
				}
				if (!('name' in body)) {
					res.write(`Missing key "name"`);
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
				const controller = await TempControllers.getController(
					body['name']
				);
				await controller.setLastTemp(temp);

				const advice = controller.getHeaterState();
				attachMessage(
					attachMessage(
						res,
						`Returning advice: "${advice}" for temp ${temp}°`
					),
					`Heater mode: "${controller.getMode()}, target: ${controller.getTarget()}`
				);
				res.write(`${advice} ${controller.getMode()}`);
				res.status(200);
				res.end();
			});

			KeyVal.GetSetListener.addListener(
				'room.heating',
				async (value, logObj) => {
					new External.Handler(logObj).setMode(
						'default',
						value === '1' ? 'on' : 'off'
					);
				}
			);
		}
	}
}
