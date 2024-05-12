import { errorHandle, requireParams, authAll } from '../../lib/decorators';
import { ResponseLike } from '../../lib/logging/response-logger';
import { LogObj } from '../../lib/logging/lob-obj';
import { triggerWebhooks } from './webhooks';

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
		} & Record<string, unknown>
	): Promise<void> {
		await triggerWebhooks(
			name,
			params,
			LogObj.fromRes(res).attachMessage(`Webhook ${name}`)
		);
		res.status(200);
		res.end();
	}
}
