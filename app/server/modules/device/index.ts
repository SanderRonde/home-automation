import { SettablePromise } from '../../lib/settable-promise';
import type { Database } from '../../lib/db';
import type { DeviceInfo } from './routing';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { DeviceAPI } from './api';

export interface DeviceDB {
	device_registry: Record<string, DeviceInfo>;
	room_icons?: Record<string, string>; // room name -> icon name
}

export const Device = new (class Device extends ModuleMeta {
	private _db = new SettablePromise<Database<DeviceDB>>();
	public api = new SettablePromise<DeviceAPI>();
	public name = 'device';

	public init(config: ModuleConfig) {
		// Initialize routing
		this._db.set(config.db);
		const api = new DeviceAPI(config.db);
		this.api.set(api);
		return {
			serve: initRouting(config, api),
		};
	}
})();
