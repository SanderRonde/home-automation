import { ModuleConfig, ModuleHookables, AllModules } from './modules';
import { errorHandle, requireParams, auth } from '../lib/decorators';
import { awaitCondition, arrToObj } from '../lib/util';
import movementConfig from '../config/movements';
import { attachMessage } from '../lib/logger';
import { ResponseLike } from './multi';
import { Bot as _Bot } from './index';
import { ModuleMeta } from './meta';
import { Database } from '../lib/db';

export interface MovementHooks {
	[key: string]: ((hookables: ModuleHookables) => any)[];
}

export namespace Movement {
	export const meta = new (class Meta extends ModuleMeta {
		name = 'movement';

		async init(config: ModuleConfig) {
			Register.init(config.db);
			Routing.init(config);
		}

		async notifyModules(modules: AllModules) {
			Register.setModules(modules);

			modules.keyval.GetSetListener.addListener(
				'state.movement',
				async value => {
					if (value === '1') {
						await Register.enable();
					} else {
						await Register.disable();
					}
				}
			);
		}
	})();

	namespace Register {
		let allModules: AllModules | null = null;
		export function setModules(modules: AllModules) {
			allModules = modules;
		}

		let enabled: boolean | null = null;
		let db: Database;
		export function init(_db: Database) {
			db = _db;
			enabled = db.get('enabled', true);
		}

		export async function enable() {
			enabled = true;
			await db.setVal('enabled', enabled);
			if (allModules) {
				new allModules.keyval.External.Handler({}, 'MOVEMENT.ON').set(
					'state.movement',
					'1',
					false
				);
			}
		}

		export async function disable() {
			enabled = false;
			await db.setVal('enabled', enabled);
			if (allModules) {
				new allModules.keyval.External.Handler({}, 'MOVEMENT.OFF').set(
					'state.movement',
					'0',
					false
				);
			}
		}

		async function createHookables(
			hookName: string,
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
							`MOVEMENT.${hookName}`
						)
					];
				})
			) as unknown) as ModuleHookables;
		}

		async function handleChange(key: string, logObj: any) {
			if (!enabled || !(key in movementConfig)) return;

			const handlers = movementConfig[key];
			for (const handler of handlers) {
				await handler(
					await createHookables(
						key,
						attachMessage(logObj, 'Movement hook')
					)
				);
			}
		}

		export function reportMovement(key: string, logObj: any) {
			handleChange(key, logObj);
		}
	}

	namespace API {
		export class Handler {
			@errorHandle
			@requireParams('key')
			@auth
			public static reportMovement(
				res: ResponseLike,
				{
					key
				}: {
					auth?: string;
					key: string;
				}
			) {
				attachMessage(res, `Reporting movement for key ${key}`);
				Register.reportMovement(key, res);
				res.status(200);
				res.end();
			}
		}
	}

	namespace Routing {
		export function init({ app }: ModuleConfig) {
			app.post('/movement/:key', async (req, res) => {
				API.Handler.reportMovement(res, {
					...req.params,
					...req.body,
					cookies: req.cookies
				});
			});
		}
	}
}
