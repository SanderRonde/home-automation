import { IGNORED_TUYA_DEVICES, TUYA_DEVICES } from './device/devices/thermostat';
import { logTag } from '../../lib/logging/logger';
import type { TuyaDevice } from './device/device';
import { DeviceSource } from '../device/device';
import { TuyaContext } from './client/context';
import type { ModuleConfig } from '../modules';
import type { Database } from '../../lib/db';
import { initRouting } from './routing';
import { TuyaAPI } from './client/api';
import { ModuleMeta } from '../meta';

export interface TuyaDB {
	credentials?: {
		apiKey: string;
		apiSecret: string;
		apiRegion: string;
		virtualDeviceId: string;
	};
}

export const Tuya = new (class Tuya extends ModuleMeta {
	public name = 'tuya';
	private _api: TuyaAPI | null = null;

	public init(config: ModuleConfig) {
		const db = config.db as Database<TuyaDB>;

		db.subscribe(async (data) => {
			if (!data || this._api) {
				return;
			}
			if (data.credentials) {
				const tuyaContext = new TuyaContext({
					baseUrl: `https://openapi.tuya${data.credentials.apiRegion}.com`,
					accessKey: data.credentials.apiKey,
					secretKey: data.credentials.apiSecret,
				});
				const api = new TuyaAPI(tuyaContext);
				try {
					const userId = await api.getUserId(data.credentials.virtualDeviceId);
					const devices = await api.getUserDevices(userId);
					const tuyaDevices: TuyaDevice[] = [];
					for (const device of devices) {
						const TuyaDevice = TUYA_DEVICES[device.product_name];
						if (!TuyaDevice) {
							if (!IGNORED_TUYA_DEVICES.includes(device.product_name)) {
								logTag(
									'tuya',
									'red',
									'Unknown device product name:',
									device.product_name
								);
							}
							continue;
						}
						tuyaDevices.push(new TuyaDevice(device.name, api, device.id));
					}
					(await config.modules.device.api.value).setDevices(
						tuyaDevices,
						DeviceSource.TUYA
					);
					this._api = api;
				} catch (error) {
					logTag('tuya', 'red', 'Failed to connect:', error);
					return;
				}
			}
		});

		return {
			serve: initRouting(db),
		};
	}
})();
