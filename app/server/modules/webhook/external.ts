import { createExternalClass } from '../../lib/external';
import { APIHandler } from './api';
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
