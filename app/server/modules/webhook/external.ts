import { Webhook } from '.';
import { createExternalClass } from '../../lib/external';
import { APIHandler } from './api';

export class ExternalHandler extends createExternalClass(true) {
	requiresInit = true;

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
