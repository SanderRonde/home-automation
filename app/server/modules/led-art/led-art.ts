import { logTag, warning } from '../../lib/logging/logger';
import { LEDClient } from './client/led-client';
import { DeviceSource } from '../device/device';
import { LEDArtDevice } from './client/device';
import type { LEDArtConfig } from './routing';
import type { Database } from '../../lib/db';
import { initRouting } from './routing';
import { diff } from '../../lib/array';
import type { ModuleConfig } from '..';
import { Data } from '../../lib/data';
import { ModuleMeta } from '../meta';

export interface LEDArtDB extends LEDArtConfig {}

export const LedArt = new (class LedArt extends ModuleMeta {
	public devices = new Data<{
		[url: string]: LEDArtDevice;
	}>({});

	public name = 'led-art';

	public init(config: ModuleConfig) {
		const db = config.db as Database<LEDArtDB>;

		db.subscribe(async (data) => {
			if (!data) {
				return;
			}
			const currentDevices = this.devices.current();
			const newDevices: { [url: string]: LEDArtDevice } = { ...currentDevices };
			const { added, removed } = diff(Object.keys(currentDevices), data.devices ?? []);

			for (const url of added) {
				try {
					const client = new LEDClient(url);
					await client.connect();
					newDevices[url] = new LEDArtDevice(url, client);
					logTag('led-art', 'magenta', 'Device initialized:', url);
				} catch (error) {
					warning('Failed to initialize led-art device:', url, error);
				}
			}

			for (const url of removed) {
				const device = currentDevices[url];
				if (device) {
					device[Symbol.dispose]();
				}
				delete newDevices[url];
			}

			this.devices.set(newDevices);

			(await config.modules.device.api.value).setDevices(
				Object.values(newDevices),
				DeviceSource.LED_ART
			);
		});

		return {
			serve: initRouting(db),
		};
	}
})();
