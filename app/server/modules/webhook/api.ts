import { errorHandle, requireParams, authAll } from '@server/lib/decorators';
import { ResponseLike, attachSourcedMessage } from '@server/lib/logger';
import { triggerWebhooks } from '@server/modules/webhook/webhooks';
import { Webhook } from '.';

export class APIHandler {
	@errorHandle
	@requireParams('name')
	@authAll
	public static async webhook(
		res: ResponseLike,
		{
			name,
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			auth,
			...params
		}: {
			auth?: string;
			name: string;
		} & Record<string, unknown>,
		source: string
	): Promise<void> {
		await triggerWebhooks(
			name,
			params,
			attachSourcedMessage(
				res,
				source,
				await Webhook.explainHook,
				`Webhook ${name}`
			)
		);
		res.status(200);
		res.end();
	}
}
