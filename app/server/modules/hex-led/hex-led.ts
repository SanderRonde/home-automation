import { logTag, warning } from '../../lib/logging/logger';
import { LEDClient } from './client/led-client';
import { DeviceSource } from '../device/device';
import { HexLEDDevice } from './client/device';
import type { HexLEDConfig } from './routing';
import type { Database } from '../../lib/db';
import { initRouting } from './routing';
import { diff } from '../../lib/array';
import type { ModuleConfig } from '..';
import { Data } from '../../lib/data';
import { ModuleMeta } from '../meta';

export interface HexLEDDB extends HexLEDConfig {}

export const HexLed = new (class HexLed extends ModuleMeta {
	public devices = new Data<{
		[url: string]: HexLEDDevice;
	}>({});

	public name = 'hex-led';

	public init(config: ModuleConfig) {
		const db = config.db as Database<HexLEDDB>;

		db.subscribe(async (data) => {
			if (!data) {
				return;
			}
			const currentDevices = this.devices.current();
			const newDevices: { [url: string]: HexLEDDevice } = { ...currentDevices };
			const { added, removed } = diff(Object.keys(currentDevices), data.devices ?? []);

			for (const url of added) {
				try {
					const client = new LEDClient(url);
					await client.connect();
					newDevices[url] = new HexLEDDevice(url, client);
					logTag('hex-led', 'magenta', 'Device initialized:', url);
				} catch (error) {
					warning('Failed to initialize hex-led device:', url, error);
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
				DeviceSource.HEX_LED
			);
		});

		return {
			serve: initRouting(db),
		};
	}
})();
