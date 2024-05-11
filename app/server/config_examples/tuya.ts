import { TuyaDevice } from '@server/modules/tuya/devices/device';
import { AllModules } from '@server/modules';

export function linkTuyaDevices(modules: AllModules): TuyaDevice[] {
	return [new TuyaDevice(modules, 'keyval', 'id', 'secretKey')];
}
