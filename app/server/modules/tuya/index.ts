import { logTag } from '../../lib/logging/logger';
import { DeviceSource } from '../device/device';
import type { Database } from '../../lib/db';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { TuyaAPI } from './api';

export interface TuyaDB {
	devices: Record<
		string,
		{
			id: string;
			key: string;
			ip: string;
			version: string;
			role?: 'master' | 'slave'; // For thermostat devices
		}
	>;
}

export const Tuya = new (class Tuya extends ModuleMeta {
	public api: TuyaAPI | null = null;
	public name = 'tuya';

	public async init(config: ModuleConfig) {
		const db = config.db as Database<TuyaDB>;
		const devices = db.current()?.devices ?? {};

		if (Object.keys(devices).length === 0) {
			logTag('tuya', 'yellow', 'No Tuya devices configured in database');
		} else {
			try {
				this.api = await new TuyaAPI(db, async (tuyaDevices) => {
					(await config.modules.device.api.value).setDevices(tuyaDevices, DeviceSource.TUYA);
				}).init(devices);
				logTag('tuya', 'blue', `Initialized ${Object.keys(devices).length} Tuya devices`);
			} catch (e) {
				logTag(
					'tuya',
					'red',
					`Failed to initialize Tuya: ${e instanceof Error ? e.message : 'Unknown error'}`
				);
			}
		}

		return {
			serve: initRouting(config, this.api),
		};
	}
})();
