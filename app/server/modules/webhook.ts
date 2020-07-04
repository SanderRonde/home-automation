import { errorHandle, requireParams, authAll } from '../lib/decorators';
import { ModuleConfig, ModuleHookables, AllModules } from './modules';
import { attachMessage, ResDummy } from '../lib/logger';
import { arrToObj, awaitCondition } from '../lib/util';
import webhooks from '../config/webhook';
import { ResponseLike } from './multi';
import { Bot as _Bot } from './bot';
import { ModuleMeta } from './meta';
import { Auth } from './auth';
import chalk from 'chalk';

export type WebHookConfig = {
	[key: string]: (hookables: ModuleHookables) => any | Promise<any>;
};

export namespace Webhook {
	export const meta = new (class Meta extends ModuleMeta {
		name = 'webhook';

		async init(config: ModuleConfig) {
			await Routing.init(config);
		}

		async notifyModules(modules: AllModules) {
			Webhooks.setModules(modules);
		}

		get external() {
			return External;
		}
	})();

	namespace Webhooks {
		let allModules: AllModules | null = null;
		export function setModules(modules: AllModules) {
			allModules = modules;
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
							`WEBHOOK.${hookName}`
						)
					];
				})
			) as unknown) as ModuleHookables;
		}

		export async function trigger(name: string, logObj: any) {
			if (!(name in webhooks)) {
				attachMessage(logObj, chalk.red('Webhook not found'));
				return;
			}

			const webhook = webhooks[name];
			await webhook(await createHookables(name, logObj));
		}
	}

	export namespace External {
		type ExternalRequest = {
			action: 'triggerWebhook';
			name: string;
		};

		export class Handler {
			constructor(private _logObj: any) {}

			private async _handleRequest(request: ExternalRequest) {
				const resDummy = new ResDummy();

				switch (request.action) {
					case 'triggerWebhook':
						await API.Handler.webhook(resDummy, {
							auth: Auth.Secret.getKey(),
							name: request.name
						});
						break;
				}
				resDummy.transferTo(this._logObj);
				return;
			}

			public triggerWebhook<N extends string>(name: N) {
				const req: ExternalRequest = {
					action: 'triggerWebhook',
					name
				};
				this._handleRequest(req);
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
				}
			) {
				await Webhooks.trigger(
					name,
					attachMessage(res, `Webhook ${name}`)
				);
				res.status(200);
				res.end();
			}
		}
	}

	export namespace Routing {
		export async function init({ app }: ModuleConfig) {
			app.post('/webhook/:name', async (req, res) => {
				await API.Handler.webhook(res, {
					...req.params,
					...req.body,
					cookies: req.cookies
				});
			});
		}
	}
}
