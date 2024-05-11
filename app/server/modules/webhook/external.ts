import { createExternalClass } from '@server/lib/external';
import { APIHandler } from '@server/modules/webhook/api';
import { Webhook } from '.';

export class ExternalHandler extends createExternalClass(true) {
	public requiresInit = true;

	public triggerWebhook<N extends string>(name: N): Promise<void> {
		return this.runRequest(async (res, source) => {
			return APIHandler.webhook(
				res,
				{
					auth: await this._getKey(res, Webhook),
					name: name,
				},
				source
			);
		});
	}
}
