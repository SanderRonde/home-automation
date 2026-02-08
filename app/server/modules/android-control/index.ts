import { AndroidControlProfileClient, getProfileClient } from './client/devices/devices';
import { logTag } from '../../lib/logging/logger';
import { DeviceSource } from '../device/device';
import type { AndroidControlDB } from './types';
import type { Database } from '../../lib/db';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { Data } from '../../lib/data';
import { ModuleMeta } from '../meta';

export const AndroidControl = new (class AndroidControl extends ModuleMeta {
	public name = 'android-control';
	public devices = new Data<Record<string, AndroidControlProfileClient>>({});

	public init(_config: ModuleConfig) {
		const db = _config.db as Database<AndroidControlDB>;

		db.subscribe(async (data) => {
			if (!data) {
				return;
			}

			const currentDevices = this.devices.current();
			const newDevices: Record<string, AndroidControlProfileClient> = {};
			for (const androidDevice of data.androidDevices ?? []) {
				// Already has device
				if (currentDevices[androidDevice.deviceId]) {
					newDevices[androidDevice.deviceId] = currentDevices[androidDevice.deviceId];
					return;
				}
				const deviceClient = await AndroidControlProfileClient.findDevice(
					androidDevice.deviceId
				);
				if (!deviceClient) {
					logTag(
						'android-control',
						'red',
						'Failed to find device:',
						androidDevice.deviceId
					);
				}
				newDevices[androidDevice.deviceId] = getProfileClient(
					androidDevice.profile,
					androidDevice.deviceId,
					deviceClient,
					_config.config
				);
			}

			this.devices.set(newDevices);
			(await _config.modules.device.api.value).setDevices(
				Object.values(newDevices),
				DeviceSource.ANDROID_CONTROL
			);
		});

		return {
			serve: initRouting(db),
		};
	}
})();
