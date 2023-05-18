import { TuyaDevice } from '../../../app/server/modules/tuya/devices/device';
import { AllModules } from '../../../app/server/modules';

export function linkTuyaDevices(modules: AllModules): TuyaDevice[] {
	return [new TuyaDevice(modules, 'keyval', 'id', 'secretKey')];
}
