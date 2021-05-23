import { errorHandle, requireParams, authAll, auth } from '../lib/decorators';
import {
	attachMessage,
	attachSourcedMessage,
	logTag,
	ResponseLike,
} from '../lib/logger';
import { AllModules, ModuleConfig } from './modules';
import { BotState } from '../lib/bot-state';
import { Database } from '../lib/db';
import { Bot as _Bot } from './bot';
import { ModuleMeta } from './meta';
import { Auth } from './auth';
import chalk from 'chalk';
import { createExternalClass } from '../lib/external';
import { createRouter } from '../lib/api';

const LOG_INTERVAL_SECS = 60;

export namespace Temperature {
	export const meta = new (class Meta extends ModuleMeta {
		name = 'temperature';

		async init(config: ModuleConfig) {
			TempControllers.init(config.db);

			Routing.init(config);

			return Promise.resolve(void 0);
		}

		get external() {
			return External;
		}

		notifyModules(modules: AllModules): Promise<void> {
			modules.keyval.GetSetListener.addListener(
				'room.heating',
				async (value, logObj) => {
					return new External.Handler(
						logObj,
						'TEMPERATURE.INIT'
					).setMode('room', value === '1' ? 'on' : 'off');
				}
			);
			return Promise.resolve(void 0);
		}

		get bot() {
			return Bot;
		}
	})();

	type Mode = 'on' | 'off' | 'auto';

	namespace TempControllers {
		let db: Database | null = null;
		const controllers: Map<string, TempControl> = new Map();

		export async function getController(
			name = 'default'
		): Promise<TempControl> {
			if (!controllers.has(name)) {
				controllers.set(name, await new TempControl().init(db!, name));
			}

			return controllers.get(name)!;
		}

		export function init(_db: Database): void {
			db = _db;
		}

		export function getAll(): TempControl[] {
			return Array.from(controllers.values());
		}
	}

	class TempControl {
		target = 20.0;
		mode: Mode = 'auto';
		lastTemp = -1;
		db: Database | null = null;
		lastLogTime = 0;
		lastLoggedTemp = -1;
		name!: string;

		move: {
			direction: 'left' | 'right';
			ms: number;
		} | null = null;

		setTarget(targetTemp: number) {
			this.db!.setVal(`${this.name}.target`, targetTemp);
			this.target = targetTemp;
		}

		async setMode(newMode: Mode) {
			this.db!.setVal(`${this.name}.mode`, newMode);
			this.mode = newMode;

			if (this.name === 'room') {
				const modules = await meta.modules;
				if (newMode === 'off') {
					await new modules.keyval.External.Handler(
						{},
						'HEATING.off'
					).set('room.heating', '0', false);
				} else {
					await new modules.keyval.External.Handler(
						{},
						'HEATING.on'
					).set('room.heating', '1', false);
				}
			}
		}

		setMove(direction: 'left' | 'right', ms: number) {
			this.move = {
				direction,
				ms,
			};
		}

		setLastTemp(temp: number, store = true, doLog = true) {
			this.lastTemp = temp;

			// Write temp to database
			if (store) {
				const tempHistory = JSON.parse(
					JSON.stringify(
						this.db!.get<
							{
								date: number;
								temp: number;
								state?: 'on' | 'off';
							}[]
						>(`${this.name}.history`, [])
					)
				);
				tempHistory.push({
					date: Date.now(),
					temp: temp,
					state: this.getHeaterState(),
				});
				this.db!.setVal(`${this.name}.history`, tempHistory);
				this.db!.setVal(`${this.name}.temp`, temp);
			}

			if (
				doLog &&
				Math.round(this.lastLoggedTemp) !== Math.round(temp) &&
				Date.now() - this.lastLogTime > LOG_INTERVAL_SECS * 1000
			) {
				logTag(
					'temp',
					'cyan',
					chalk.bold(`Current ${this.name} temperature: ${temp}°`)
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
			if (this.mode !== 'auto') {
				return this.mode;
			}
			if (this.lastTemp > this.target) {
				return 'off';
			}
			return 'on';
		}

		getMove() {
			const move = this.move;
			this.move = null;
			return move;
		}

		async init(database: Database, name: string) {
			this.db = database;
			this.name = name;

			const target = database.get(`${name}.target`, 20.0);
			const prevMode = database.get(`${name}.mode`, 'auto');

			this.setTarget(target);
			await this.setMode(prevMode);

			const temp = database.get(`${name}.temp`, 20.0);

			this.setLastTemp(temp, false, false);

			return this;
		}
	}

	export namespace External {
		export class Handler extends createExternalClass(false) {
			public setMode(name: string, mode: Mode): Promise<void> {
				return this.runRequest((res, source) => {
					return API.Handler.setMode(
						res,
						{
							auth: Auth.Secret.getKey(),
							mode,
							name,
						},
						source
					);
				});
			}

			public setTarget(name: string, target: number): Promise<void> {
				return this.runRequest((res, source) => {
					return API.Handler.setTargetTemp(
						res,
						{
							auth: Auth.Secret.getKey(),
							target,
							name,
						},
						source
					);
				});
			}

			public getTemp(name: string): Promise<{
				temp: number;
			}> {
				return this.runRequest((res, source) => {
					return API.Handler.getTemp(
						res,
						{
							auth: Auth.Secret.getKey(),
							name,
						},
						source
					);
				});
			}

			public moveDir(
				name: string,
				direction: 'left' | 'right',
				ms: number
			): Promise<string> {
				return this.runRequest((res, source) => {
					return API.Handler.moveDir(
						res,
						{
							auth: Auth.Secret.getKey(),
							direction,
							ms,
							name,
						},
						source
					);
				});
			}
		}
	}

	export namespace Bot {
		export class Bot extends BotState.Base {
			static readonly commands = {
				'/temp': 'Get the current temperature',
				'/heat': 'Start heating',
				'/heatoff': 'Stop heating',
				'/heatauto': 'Set heat mode to auto',
				'/help_temperature': 'Print help commands for temperature',
			};

			static readonly botName = 'Temperature';

			static readonly matches = Bot.createMatchMaker(
				({ matchMaker: mm }) => {
					mm(
						'/temp',
						/what (is|are) the(current )?temp(erature)?(s)?/,
						/what temp(erature)? is it(\?)?/,
						/how (warm|cold) is it(\?)?/,
						({ logObj }) => {
							attachMessage(
								logObj,
								`Reporting temperatures ${TempControllers.getAll()
									.map((controller) => {
										return Math.round(
											controller.getLastTemp()
										);
									})
									.join(', ')}`
							);
							const contents = [];
							for (const controller of TempControllers.getAll()) {
								contents.push(
									...[
										['Name', controller.name],
										[
											'Temp',
											String(
												Math.round(
													controller.getLastTemp() *
														10
												) / 10
											),
										],
										[
											'Heater state',
											controller.getHeaterState(),
										],
										['Heater mode', controller.getMode()],
										[
											'Target temperature',
											String(controller.getTarget()),
										],
										['', ''],
									]
								);
							}

							return Bot.makeTable({
								contents: contents,
							});
						}
					);
					mm(
						/\/heatoff (\w+)/,
						/stop heating (\w+)/,
						/make (\w+) cold/,
						async ({ logObj, match }) => {
							const tempName = match[1];
							await new External.Handler(
								attachMessage(logObj, 'Stopping heating'),
								'TEMPERATURE.BOT'
							).setMode(tempName, 'off');
							return 'Stopping heating';
						}
					);
					mm(/\/heatauto (\w+)/, async ({ logObj, match }) => {
						const tempName = match[1];
						await new External.Handler(
							attachMessage(logObj, 'Set heat mode to auto'),
							'TEMPERATURE.BOT'
						).setMode(tempName, 'auto');
						return 'Set heat mode to auto';
					});
					mm(
						/\/heat (\w+)/,
						/start heating (\w+)/,
						/make (\w+) hot/,
						/heat (\w+)/,
						async ({ logObj, match }) => {
							const tempName = match[1];
							await new External.Handler(
								attachMessage(logObj, 'Heating'),
								'TEMPERATURE.BOT'
							).setMode(tempName, 'on');
							return 'Heating';
						}
					);
					mm(
						/\/move (\w+) (left|right) for (\d+)ms/,
						async ({ logObj, match }) => {
							const tempName = match[1];
							await new External.Handler(
								attachMessage(logObj, 'Moving'),
								'TEMPERATURE.BOT'
							).moveDir(
								tempName,
								match[2] as 'left' | 'right',
								parseInt(match[3], 10)
							);
							return 'Moving temporarily';
						}
					);
					mm(
						/set(?: temp(?:erature)?) mode to (\w+) for (\w+)/,
						async ({ logObj, match }) => {
							const mode = match[1];
							const tempName = match[2];
							if (['on', 'off', 'auto'].indexOf(mode) === -1) {
								return 'Invalid mode';
							}
							await new External.Handler(
								attachMessage(
									logObj,
									`Setting mode to ${mode}`
								),
								'TEMPERATURE.BOT'
							).setMode(tempName, mode as Mode);
							return `Set mode to ${mode}`;
						}
					);
					mm(
						/set(?: temp(?:erature)?) target to ((\d+)(\.\d+)?) for (\w+)/,
						async ({ logObj, match }) => {
							const target = parseFloat(match[1]);
							const tempName = match[2];
							if (
								Number.isNaN(target) ||
								target === 0 ||
								target < 0
							) {
								return 'Invalid target';
							}
							await new External.Handler(
								attachMessage(
									logObj,
									`Setting temp to ${target}`
								),
								'TEMPERATURE.BOT'
							).setTarget(tempName, target);
							return `Set target to ${target}`;
						}
					);

					mm(
						'/help_temperature',
						/what commands are there for temperature/,
						() => {
							return `Commands are:\n${Bot.matches.matches
								.map((match) => {
									return `RegExps: ${match.regexps
										.map((r) => r.source)
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
					matchConfig: Bot.matches,
				});
			}

			toJSON(): Record<string, never> {
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
					name,
				}: {
					auth?: string;
					mode: Mode;
					name: string;
				},
				source: string
			): Promise<void> {
				const controller = await TempControllers.getController(name);
				const oldMode = controller.getMode();
				attachSourcedMessage(
					res,
					source,
					await meta.explainHook,
					`Setting mode to ${mode} from ${oldMode}`
				);
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
					name,
				}: {
					auth?: string;
					target: number;
					name: string;
				},
				source: string
			): Promise<void> {
				const controller = await TempControllers.getController(name);
				const oldTemp = controller.getTarget();
				attachSourcedMessage(
					res,
					source,
					await meta.explainHook,
					`Setting target temp to ${target} from ${oldTemp}`
				);
				controller.setTarget(target);
				res.status(200);
				res.end();
			}

			@errorHandle
			@authAll
			public static async getTemp(
				res: ResponseLike,
				{
					name,
				}: {
					auth?: string;
					name: string;
				},
				source: string
			): Promise<{
				temp: number;
			}> {
				const controller = await TempControllers.getController(name);
				attachSourcedMessage(
					res,
					source,
					await meta.explainHook,
					`Getting temp. Returning ${controller.getLastTemp()}`
				);
				res.status(200);
				res.write(
					JSON.stringify({
						temp: controller.getLastTemp(),
					})
				);
				res.end();
				return {
					temp: controller.getLastTemp(),
				};
			}

			@errorHandle
			@authAll
			public static async moveDir(
				res: ResponseLike,
				{
					name,
					direction,
					ms,
				}: {
					auth?: string;
					name: string;
					direction: 'left' | 'right';
					ms: number;
				},
				source: string
			): Promise<string> {
				const controller = await TempControllers.getController(name);
				attachSourcedMessage(
					res,
					source,
					await meta.explainHook,
					`Setting move for controller ${name} to ${ms}ms in the direction ${direction}`
				);
				controller.setMove(direction, ms);
				res.status(200);
				res.write('OK');
				res.end();
				return 'OK';
			}
		}
	}

	export namespace Routing {
		export function init({ app }: ModuleConfig): void {
			const router = createRouter(Temperature, API.Handler);
			router.post('/target/:target?', 'setTargetTemp');
			router.post('/mode/:mode?', 'setMode');
			router.all('/temp', 'getTemp');

			app.post('/temperature/report/:name/:temp?', async (req, res) => {
				const body = { ...req.params, ...req.body, ...req.query } as {
					temp?: string;
					name: string;
				};
				if (!('temp' in body)) {
					res.write('Missing key "temp"');
					res.status(400);
					res.end();
					return;
				}
				if (!('name' in body)) {
					res.write('Missing key "name"');
					res.status(400);
					res.end();
					return;
				}
				const temp = parseFloat(body.temp!);
				if (Number.isNaN(temp) || temp === 0) {
					res.write(`Invalid temperature "${body.temp!}"`);
					res.status(400);
					res.end();
					return;
				}

				// Set last temp
				const controller = await TempControllers.getController(
					body['name']
				);
				controller.setLastTemp(temp);

				attachMessage(
					res,
					`Reported temperature: "${controller.getLastTemp()}`
				);
				res.status(200);
				res.end();
			});

			app.post('/temperature/advise/:name', async (req, res) => {
				const body = { ...req.params, ...req.body, ...req.query } as {
					name: string;
				};

				const controller = await TempControllers.getController(
					body['name']
				);

				const advice = controller.getHeaterState();
				attachMessage(
					attachMessage(
						res,
						`Returning advice: "${advice}" for temp ${controller.getLastTemp()}°`
					),
					`Heater mode: "${controller.getMode()}, target: ${controller.getTarget()}`
				);
				res.write(`${advice} ${controller.getMode()}`);
				res.status(200);
				res.end();
			});

			app.post('/temperature/moves/:name', async (req, res) => {
				const body = { ...req.params, ...req.body, ...req.query } as {
					name: string;
				};

				const controller = await TempControllers.getController(
					body['name']
				);

				const move = controller.getMove();
				if (!move) {
					attachMessage(
						res,
						`Returning no move for controller ${body.name}`
					);
					res.write('0 l');
				} else {
					attachMessage(
						res,
						`Returning move ${move.ms}ms in direction ${move.direction} for controller ${body['name']}`
					);
					res.write(
						`${move.ms} ${move.direction === 'left' ? 'l' : 'r'}`
					);
				}
				res.status(200);
				res.end();
			});

			router.use(app);
		}
	}
}
