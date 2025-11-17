import { SettablePromise } from '../../lib/settable-promise';
import type { Database } from '../../lib/db';
import { WebhookAPI } from './webhook-api';
import type { WebhookDB } from './types';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const Webhook = new (class Webhook extends ModuleMeta {
	private _db = new SettablePromise<Database<WebhookDB>>();
	public api = new SettablePromise<WebhookAPI>();
	public name = 'webhook';

	public init(config: ModuleConfig) {
		this._db.set(config.db);

		const api = new WebhookAPI(config.db);
		this.api.set(api);

		return {
			serve: initRouting(config, api),
		};
	}
})();
