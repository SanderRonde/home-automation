import {
	MIN_PRESSURE,
	MAX_PRESSURE,
	DEFAULT_MIN_TIME,
	MAX_PRESSURE_TIME,
	PRESSURE_SAMPLE_TIME
} from '../lib/constants';
import {
	ModuleConfig,
	ModuleHookables,
	AllModules,
} from './modules';
import { errorHandle, requireParams, auth } from '../lib/decorators';
import pressureConfig from '../config/pressures';
import { attachMessage, disableMessages } from '../lib/logger';
import { BotState } from '../lib/bot-state';
import { ResponseLike } from './multi';
import { Database } from '../lib/db';
import { Bot as _Bot } from './index';
import { ModuleMeta } from './meta';
import { createExternalClass } from '../lib/external';
import { createHookables } from '../lib/util';

export const enum PRESSURE_CHANGE_DIRECTION {
	UP,
	DOWN
}

export const enum PRESSURE_REGISTER {
	REGISTER_CHANGED,
	IGNORE_CHANGE
}

export interface PressureRange {
	type: 'range';
	/**
	 * A starting range, minimum value is 0.
	 * Set to 0 if omitted
	 */
	from?: number;
	/**
	 * A starting range, maximumm value is 1024
	 * Set to 1024 if omitted
	 */
	to?: number;
	/**
	 * How long the range should be held for the handler to be
	 * triggered (in ms)
	 */
	minTime?: number;
	/**
	 * A handler that is executed when the pressure falls in given range
	 */
	handler: (
		hookables: ModuleHookables
	) => PRESSURE_REGISTER | Promise<PRESSURE_REGISTER>;
}

export interface PressureChange {
	type: 'change';
	/**
	 * The size of the jump
	 */
	amount: number;
	/**
	 * The direction in which the change occurs
	 */
	direction: PRESSURE_CHANGE_DIRECTION;
	/**
	 * How long the range should be held for the handler to be
	 * triggered (in ms)
	 */
	minTime?: number;
	/**
	 * A handler that is executed when the pressure falls in given range
	 */
	handler: (hookables: ModuleHookables) => any | Promise<any>;
}

export interface PressureHooks {
	[key: string]: (PressureRange | PressureChange)[];
}

export namespace Pressure {
	export const meta = new (class Meta extends ModuleMeta {
		name = 'pressure';

		async init(config: ModuleConfig) {
			Register.init(config.db);
			Routing.init(config);
		}

		async notifyModules(modules: AllModules) {
			Register.setModules(modules);

			modules.keyval.GetSetListener.addListener(
				'state.pressure',
				async (value, logObj) => {
					const handler = new External.Handler(logObj, 'KEYVAL');
					if (value === '1') {
						await handler.enable();
					} else {
						await handler.disable();
					}
				},
				{ notifyOnInitial: true }
			);
		}

		get external() {
			return External;
		}

		get bot() {
			return Bot;
		}
	})();

	namespace Register {
		let enabled: boolean | null = null;
		let db: Database;
		let resolveDbPromise: () => void;
		let dbSet: Promise<void> = new Promise(resolve => {
			resolveDbPromise = resolve;
		});
		let allModules: AllModules | null = null;

		export async function enable() {
			enabled = true;
			await dbSet;
			await db.setVal('enabled', enabled);
			if (allModules) {
				new allModules.keyval.External.Handler({}, 'PRESSURE.ON').set(
					'state.pressure',
					'1',
					false
				);
			}
		}

		export function isEnabled() {
			return enabled || false;
		}

		export async function disable() {
			enabled = false;
			await dbSet;
			await db.setVal('enabled', enabled);
			if (allModules) {
				new allModules.keyval.External.Handler({}, 'PRESSURE.OFF').set(
					'state.pressure',
					'0',
					false
				);
			}
		}

		export function init(_db: Database) {
			db = _db;
			enabled = _db.get('enabled', true);
			resolveDbPromise();
		}

		export function setModules(modules: AllModules) {
			allModules = modules;
		}

		async function handleChange(key: string, logObj: any) {
			if (!(key in pressureConfig)) return;

			const ranges = pressureConfig[key];
			for (const range of ranges) {
				if (range.type === 'range') {
					const {
						from = MIN_PRESSURE,
						to = MAX_PRESSURE,
						minTime = DEFAULT_MIN_TIME,
						handler
					} = range;
					if (minTime >= MAX_PRESSURE_TIME) {
						throw new Error('MinTime too big');
					}

					const currentRange = currentRanges.get(key);
					if (currentRange === range) continue;

					if (
						lastPressures
							.get(key)!
							.slice(-(minTime / PRESSURE_SAMPLE_TIME))
							.every(value => {
								return value >= from && value <= to;
							})
					) {
						let doUpdate: boolean = currentRanges.has(key);
						if (
							!doUpdate ||
							(await handler(
								await createHookables(
									await meta.modules,
									'PRESSURE',
									key,
									attachMessage(
										logObj,
										'Pressure hooks range'
									)
								)
							)) === PRESSURE_REGISTER.REGISTER_CHANGED
						) {
							currentRanges.set(key, range);
						}
					}
				} else {
					const {
						amount,
						direction,
						handler,
						minTime = DEFAULT_MIN_TIME
					} = range;

					const samples = minTime / PRESSURE_SAMPLE_TIME;
					const [initial, ...rest] = lastPressures
						.get(key)!
						.slice(-samples)
						.map(v => ~~v);
					if (rest.length < samples - 1) continue;
					if (
						rest.every(value => {
							if (direction === PRESSURE_CHANGE_DIRECTION.UP) {
								return value >= initial + amount;
							} else {
								return value <= initial - amount;
							}
						})
					) {
						handler(
							await createHookables(
								await meta.modules,
								'PRESSURE',
								key,
								attachMessage(logObj, 'Pressure hooks jump')
							)
						);
					}
				}
			}
		}

		const currentRanges: Map<string, PressureRange> = new Map();
		const lastPressures: Map<string, number[]> = new Map();
		const pressures: Map<string, number> = new Map();
		export function setPressure(key: string, value: number, logObj: any) {
			if (!lastPressures.get(key)) {
				lastPressures.set(key, []);
			}
			const lastPressureArr = lastPressures.get(key)!;
			lastPressureArr.push(value);
			if (
				lastPressureArr.length >
				MAX_PRESSURE_TIME / PRESSURE_SAMPLE_TIME
			) {
				lastPressureArr.shift();
			}

			pressures.set(key, value);
			if (enabled) {
				handleChange(key, logObj);
			}
		}

		export function getPressure(key: string): number | null {
			return pressures.get(key) || null;
		}

		export function getAll() {
			return pressures;
		}
	}

	export namespace External {
		export class Handler extends createExternalClass(false) {
			async enable() {
				return this.runRequest(async (_res, _source, logObj) => {
					await Register.enable();
					attachMessage(logObj, 'Enabled pressure module');
				});
			}

			async disable() {
				return this.runRequest(async (_res, _source, logObj) => {
					await Register.disable();
					attachMessage(logObj, 'Disabled pressure module');
				});
			}

			async isEnabled() {
				return this.runRequest(async (_res, _source, logObj) => {
					const isEnabled = await Register.isEnabled();
					attachMessage(
						logObj,
						'Got enabled status of pressure module'
					);
					return isEnabled;
				});
			}

			async get(key: string): Promise<number | null> {
				return this.runRequest(async (_res, _source, logObj) => {
					const pressure = await Register.getPressure(key);
					attachMessage(
						logObj,
						`Returning pressure ${pressure} for key ${key}`
					);
					return pressure;
				});
			}
		}
	}

	export namespace Bot {
		export interface JSON {}

		export class Bot extends BotState.Base {
			static readonly commands = {
				'/pressure': 'Turn on pressure module',
				'/pressureoff': 'Turn off pressure module',
				'/help_pressure': 'Print help comands for keyval'
			};

			static readonly botName = 'Pressure';

			static readonly matches = Bot.createMatchMaker(
				({ matchMaker: mm, fallbackSetter: fallback }) => {
					mm(
						'/pressureoff',
						/turn off pressure( module)?/,
						async ({ logObj }) => {
							new External.Handler(
								logObj,
								'PRESSURE.BOT'
							).disable();
							return 'Turned off pressure module';
						}
					);
					mm('/pressures', /what are the pressures/, async () => {
						return Bot.makeTable({
							header: ['key', 'value'],
							contents: Array.from(
								Register.getAll().entries()
							).map(([key, pressure]) => {
								return [key, pressure + ''];
							})
						});
					});
					mm(
						'/pressure',
						/turn on pressure( module)?/,
						async ({ logObj }) => {
							new External.Handler(
								logObj,
								'PRESSURE.BOT'
							).enable();
							return 'Turned on pressure module';
						}
					);
					mm(
						'/help_pressure',
						/what commands are there for pressure/,
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

			static async match(
				config: _Bot.Message.MatchParameters
			): Promise<_Bot.Message.MatchResponse | undefined> {
				return await this.matchLines({
					...config,
					matchConfig: Bot.matches
				});
			}

			constructor(_json?: JSON) {
				super();
			}

			toJSON(): JSON {
				return {};
			}
		}
	}

	namespace API {
		export class Handler {
			@errorHandle
			@requireParams('key', 'pressure')
			@auth
			public static reportPressure(
				res: ResponseLike,
				{
					key,
					pressure
				}: {
					auth?: string;
					key: string;
					pressure: string;
				}
			) {
				attachMessage(
					res,
					`Setting pressure key ${key} to ${pressure}`
				);
				Register.setPressure(key, ~~pressure, res);
				res.status(200);
				res.end();
			}
		}
	}

	namespace Routing {
		export function init({ app, config }: ModuleConfig) {
			app.post('/pressure/:key/:pressure', async (req, res) => {
				if (config.log.ignorePressure) {
					disableMessages(res);
				}
				API.Handler.reportPressure(res, {
					...req.params,
					...req.body,
					cookies: req.cookies
				});
			});
		}
	}
}
