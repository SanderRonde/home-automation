import { logTag } from '../../lib/logging/logger';
import { DeviceSource } from '../device/device';
import type { ModuleConfig } from '../modules';
import type { Database } from '../../lib/db';
import { initRouting } from './routing';
import { ModuleMeta } from '../meta';
import type { TuyaDB } from './api';
import { TuyaAPI } from './api';

export const Tuya = new (class Tuya extends ModuleMeta {
	public api: TuyaAPI | null = null;
	public name = 'tuya';

	public async init(config: ModuleConfig) {
		const db = config.db as Database<TuyaDB>;

		// Initialize Tuya API
		this.api = new TuyaAPI(db, async (devices) => {
			(await config.modules.device.api.value).setDevices(devices, DeviceSource.TUYA);
		});

		// Connect to configured devices
		try {
			await this.api.init();
			logTag('TUYA', 'green', 'Tuya module initialized');
		} catch (e) {
			logTag(
				'TUYA',
				'yellow',
				`Failed to initialize Tuya: ${e instanceof Error ? e.message : 'Unknown error'}`
			);
		}

		return {
			serve: initRouting(config, this.api),
		};
	}

	public override async onBackOnline() {
		// Reconnect devices when network comes back online
		if (this.api) {
			await this.api.init();
		}
	}
})();
