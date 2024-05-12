import { createExternalClass } from '../../lib/external';
import { LogObj } from '../../lib/logging/lob-obj';
import { APIHandler } from './api';
import { Webhook } from '.';

export class ExternalHandler extends createExternalClass(true) {
	public requiresInit = true;

	public triggerWebhook<N extends string>(name: N): Promise<void> {
		return this.runRequest(async (res) => {
			return APIHandler.webhook(res, {
				auth: await this._getKey(LogObj.fromRes(res), Webhook),
				name: name,
			});
		});
	}
}
