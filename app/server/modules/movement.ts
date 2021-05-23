import { ModuleConfig, ModuleHookables, AllModules } from './modules';
import { errorHandle, requireParams, auth } from '../lib/decorators';
import movementConfig from '../config/movements';
import {
	attachMessage,
	attachSourcedMessage,
	LogObj,
	ResponseLike,
} from '../lib/logger';
import { Bot as _Bot } from './index';
import { ModuleMeta } from './meta';
import { Database } from '../lib/db';
import { createHookables, SettablePromise } from '../lib/util';
import { createRouter } from '../lib/api';

export interface MovementHooks {
	[key: string]: ((hookables: ModuleHookables) => unknown)[];
}

export namespace Movement {
	export const meta = new (class Meta extends ModuleMeta {
		name = 'movement';

		async init(config: ModuleConfig) {
			Register.init(config.db);
			Routing.init(config);

			return Promise.resolve(void 0);
		}

		notifyModules(modules: AllModules) {
			modules.keyval.GetSetListener.addListener(
				'state.movement',
				async (value) => {
					if (value === '1') {
						await Register.enable();
					} else {
						await Register.disable();
					}
				},
				{ notifyOnInitial: true }
			);

			return Promise.resolve(void 0);
		}
	})();

	namespace Register {
		let enabled: boolean | null = null;
		const db = new SettablePromise<Database>();

		export function init(_db: Database): void {
			enabled = _db.get('enabled', true);
			db.set(_db);
		}

		export async function enable(): Promise<void> {
			enabled = true;
			(await db.value).setVal('enabled', enabled);
			const modules = await meta.modules;
			await new modules.keyval.External.Handler({}, 'MOVEMENT.ON').set(
				'state.movement',
				'1',
				false
			);
		}

		export async function disable(): Promise<void> {
			enabled = false;
			(await db.value).setVal('enabled', enabled);
			const modules = await meta.modules;
			await new modules.keyval.External.Handler({}, 'MOVEMENT.OFF').set(
				'state.movement',
				'0',
				false
			);
		}

		async function handleChange(key: string, logObj: LogObj) {
			if (!enabled || !(key in movementConfig)) {
				return;
			}

			const handlers = movementConfig[key];
			for (const handler of handlers) {
				await handler(
					createHookables(
						await meta.modules,
						'MOVEMENT',
						key,
						attachMessage(logObj, 'Movement hook')
					)
				);
			}
		}

		export async function reportMovement(
			key: string,
			logObj: LogObj
		): Promise<void> {
			await handleChange(key, logObj);
		}
	}

	namespace API {
		export class Handler {
			@errorHandle
			@requireParams('key')
			@auth
			public static async reportMovement(
				res: ResponseLike,
				{
					key,
				}: {
					auth?: string;
					key: string;
				},
				source: string
			): Promise<void> {
				attachSourcedMessage(
					res,
					source,
					await meta.explainHook,
					`Reporting movement for key ${key}`
				);
				await Register.reportMovement(key, res);
				res.status(200);
				res.end();
			}
		}
	}

	namespace Routing {
		export function init({ app }: ModuleConfig): void {
			const router = createRouter(Movement, API.Handler);
			router.post('/:key', 'reportMovement');
			router.use(app);
		}
	}
}
