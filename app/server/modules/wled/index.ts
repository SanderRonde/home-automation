import { DeviceSource } from '../device/device';
import { WLEDDevice } from './client/device';
import type { Database } from '../../lib/db';
import type { WLEDConfig } from './routing';
import { WLEDClient } from 'wled-client';
import { initRouting } from './routing';
import { diff } from '../../lib/array';
import type { ModuleConfig } from '..';
import { Data } from '../../lib/data';
import { ModuleMeta } from '../meta';

export interface WLEDDB extends WLEDConfig {}

export const WLed = new (class WLed extends ModuleMeta {
	public devices = new Data<{
		[ip: string]: WLEDDevice;
	}>({});

	public name = 'wled';

	public init(config: ModuleConfig) {
		const db = config.db as Database<WLEDDB>;
		db.subscribe(async (data) => {
			const currentDevices = this.devices.current();
			const newDevices = { ...currentDevices };
			const { added, removed } = diff(Object.keys(currentDevices), data.devices ?? []);
			for (const ip of added) {
				const client = new WLEDClient(ip);
				await client.init();
				await client.refreshInfo();
				newDevices[ip] = new WLEDDevice(ip, client.info, client);
			}
			for (const ip of removed) {
				delete newDevices[ip];
			}
			this.devices.set(newDevices);

			(await config.modules.device.api.value).setDevices(
				Object.values(newDevices),
				DeviceSource.WLED
			);
		});
		return {
			serve: initRouting(db),
		};
	}
})();
