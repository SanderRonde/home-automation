import { errorHandle, requireParams, authAll } from '../lib/decorators';
import { ModuleConfig, ModuleHookables } from './modules';
import { attachMessage, attachSourcedMessage, ResponseLike } from '../lib/logger';
import webhooks from '../config/webhook';
import { Bot as _Bot } from './bot';
import { ModuleMeta } from './meta';
import { Auth } from './auth';
import chalk from 'chalk';
import { createExternalClass } from '../lib/external';
import { createAPIHandler } from '../lib/api';
import { createHookables } from '../lib/util';

export type WebHookConfig = {
	[key: string]: (hookables: ModuleHookables) => any | Promise<any>;
};

export namespace Webhook {
	export const meta = new (class Meta extends ModuleMeta {
		name = 'webhook';

		async init(config: ModuleConfig) {
			await Routing.init(config);
		}

		get external() {
			return External;
		}
	})();

	namespace Webhooks {
		export async function trigger(name: string, logObj: any) {
			if (!(name in webhooks)) {
				attachMessage(logObj, chalk.red('Webhook not found'));
				return;
			}

			const webhook = webhooks[name];
			await webhook(
				await createHookables(
					await meta.modules,
					'WEBHOOK',
					name,
					logObj
				)
			);
		}
	}

	export namespace External {
		export class Handler extends createExternalClass(true) {
			requiresInit = true;

			public triggerWebhook<N extends string>(name: N) {
				return this.runRequest((res, source) => {
					return API.Handler.webhook(
						res,
						{
							auth: Auth.Secret.getKey(),
							name: name
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
					name
				}: {
					auth?: string;
					name: string;
				},
				source: string
			) {
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
		export async function init({ app }: ModuleConfig) {
			app.post(
				'/webhook/:name',
				createAPIHandler(Webhook, API.Handler.webhook)
			);
		}
	}
}
