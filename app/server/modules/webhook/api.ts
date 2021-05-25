import { Webhook } from '.';
import { errorHandle, requireParams, authAll } from '../../lib/decorators';
import { ResponseLike, attachSourcedMessage } from '../../lib/logger';
import { triggerWebhooks } from './webhooks';

export class APIHandler {
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
		await triggerWebhooks(
			name,
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
