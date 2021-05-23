import { errorHandle, requireParams, authAll } from '../lib/decorators';
import { ModuleConfig, ModuleHookables } from './modules';
import {
	attachMessage,
	attachSourcedMessage,
	LogObj,
	ResponseLike,
} from '../lib/logger';
import webhooks from '../config/webhook';
import { Bot as _Bot } from './bot';
import { ModuleMeta } from './meta';
import { Auth } from './auth';
import chalk from 'chalk';
import { createExternalClass } from '../lib/external';
import { createRouter } from '../lib/api';
import { createHookables } from '../lib/util';
import { PossiblePromise } from '../lib/type';

export type WebHookConfig = {
	[key: string]: (hookables: ModuleHookables) => PossiblePromise<void>;
};

export namespace Webhook {
	export const meta = new (class Meta extends ModuleMeta {
		name = 'webhook';

		init(config: ModuleConfig) {
			Routing.init(config);
			return Promise.resolve(void 0);
		}

		get external() {
			return External;
		}
	})();

	namespace Webhooks {
		export async function trigger(
			name: string,
			logObj: LogObj
		): Promise<void> {
			if (!(name in webhooks)) {
				attachMessage(logObj, chalk.red('Webhook not found'));
				return;
			}

			const webhook = webhooks[name];
			await webhook(
				createHookables(await meta.modules, 'WEBHOOK', name, logObj)
			);
		}
	}

	export namespace External {
		export class Handler extends createExternalClass(true) {
			requiresInit = true;

			public triggerWebhook<N extends string>(name: N): Promise<void> {
				return this.runRequest((res, source) => {
					return API.Handler.webhook(
						res,
						{
							auth: Auth.Secret.getKey(),
							name: name,
						},
						source
					);
				});
			}
		}
	}

	export namespace API {
		export class Handler {
			@errorHandle
			@requireParams('name')
			@authAll
			public static async webhook(
				res: ResponseLike,
				{
					name,
				}: {
					auth?: string;
					name: string;
				},
				source: string
			): Promise<void> {
				await Webhooks.trigger(
					name,
					attachSourcedMessage(
						res,
						source,
						await meta.explainHook,
						`Webhook ${name}`
					)
				);
				res.status(200);
				res.end();
			}
		}
	}

	export namespace Routing {
		export function init({ app }: ModuleConfig): void {
			const router = createRouter(Webhook, API.Handler);
			router.post('/:name', 'webhook');
			router.use(app);
		}
	}
}
