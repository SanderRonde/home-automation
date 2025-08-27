import { SettablePromise } from '../../lib/settable-promise';
import type { Database } from '../../lib/db';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { DeviceAPI } from './api';

export const Device = new (class Device extends ModuleMeta {
	private _db = new SettablePromise<Database>();
	public api = new SettablePromise<DeviceAPI>();
	public name = 'device';

	public init(config: ModuleConfig) {
		// Initialize routing
		this._db.set(config.db);
		const api = new DeviceAPI(config.db);
		this.api.set(api);
		return {
			routes: initRouting(config, api),
		};
	}
})();
