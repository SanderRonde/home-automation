import { logTag } from '../../lib/logging/logger';
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

	private async _updateDevices(
		config: ModuleConfig,
		data: Partial<WLEDDB> = config.db.current()
	) {
		const currentDevices = this.devices.current();
		const newDevices = { ...currentDevices };
		const { added, removed } = diff(Object.keys(currentDevices), data.devices ?? []);
		let changed = false;
		for (const ip of added) {
			try {
				const client = new WLEDClient(ip);
				// Gets around a bug where handleErrors is not bound to the client
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
				(client as any).JSONAPI.handleErrors =
					// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
					(client as any).JSONAPI.handleErrors.bind(
						// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
						(client as any).JSONAPI
					);
				if (await client.init()) {
					await client.refreshInfo();
					newDevices[ip] = new WLEDDevice(ip, client.info, client);
					changed = true;
				}
			} catch (error) {
				logTag('WLED', 'red', 'Error initializing device:', ip, error);
			}
		}
		for (const ip of removed) {
			delete newDevices[ip];
			changed = true;
		}

		if (changed) {
			this.devices.set(newDevices);
			(await config.modules.device.api.value).setDevices(
				Object.values(newDevices),
				DeviceSource.WLED
			);
		}
	}

	public init(config: ModuleConfig) {
		const db = config.db as Database<WLEDDB>;
		db.subscribe(async (data) => {
			if (!data) {
				return;
			}
			await this._updateDevices(config, data);
		});
		setInterval(
			() => {
				void this._updateDevices(config);
			},
			60 * 1000 * 15
		);
		return {
			serve: initRouting(db),
		};
	}
})();
