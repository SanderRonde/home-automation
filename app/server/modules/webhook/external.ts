import { createExternalClass } from '../../lib/external';
import { Auth } from '../auth';
import { APIHandler } from './api';

export class ExternalHandler extends createExternalClass(true) {
	requiresInit = true;

	public triggerWebhook<N extends string>(name: N): Promise<void> {
		return this.runRequest((res, source) => {
			return APIHandler.webhook(
				res,
				{
					// TODO: replace with external
					auth: Auth.Secret.getKey(),
					name: name,
				},
				source
			);
		});
	}
}
