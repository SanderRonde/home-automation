import { TuyaThermostatCluster } from '../cluster';
import type { TuyaAPI } from '../../client/api';
import { TuyaDevice } from '../device';

export class TuyaThermostatDevice extends TuyaDevice {
	public constructor(name: string, api: TuyaAPI, deviceId: string) {
		super(name, deviceId, [new TuyaThermostatCluster(api, deviceId)], []);
	}
}

export const IGNORED_TUYA_DEVICES = ['LED Floor Ambient Light'];

export const TUYA_DEVICES: Record<
	string,
	new (name: string, api: TuyaAPI, deviceId: string) => TuyaDevice
> = {
	'Smart WiFi TRV 16': TuyaThermostatDevice,
	'WT198-Smart Wifi Thermostat': TuyaThermostatDevice,
	// Yes a spelling mistake
	'WiFi Thermostat Radiator Vavle': TuyaThermostatDevice,
};
