import { SettablePromise } from '../../lib/settable-promise';
import type * as Icons from '@mui/icons-material';
import type { Database } from '../../lib/db';
import type { DeviceInfo } from './routing';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { DeviceAPI } from './api';

export interface DeviceDB {
	device_registry: Record<string, DeviceInfo>;
	room_icons?: {
		[room: string]: keyof typeof Icons;
	};
}

export const Device = new (class Device extends ModuleMeta {
	private _db = new SettablePromise<Database<DeviceDB>>();
	public api = new SettablePromise<DeviceAPI>();
	public name = 'device';

	public async init(config: ModuleConfig) {
		// Initialize routing
		this._db.set(config.db);

		// Initialize SQL table for occupancy events
		const tableExists = await config.sqlDB<{ name: string }[]>`
			SELECT name FROM sqlite_master WHERE type='table' AND name='occupancy_events'
		`;

		if (!tableExists.length) {
			await config.sqlDB`
				CREATE TABLE occupancy_events (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					device_id TEXT NOT NULL,
					occupied BOOLEAN NOT NULL,
					timestamp INTEGER NOT NULL
				)
			`;
			await config.sqlDB`
				CREATE INDEX idx_occupancy_device_time ON occupancy_events(device_id, timestamp DESC)
			`;
		}

		const api = new DeviceAPI(config.db, config.sqlDB);
		this.api.set(api);
		return {
			serve: initRouting(config, api),
		};
	}
})();
