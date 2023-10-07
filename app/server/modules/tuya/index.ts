import { linkTuyaDevices } from '../../config/tuya';
import { TuyaDevice } from './devices/device';
import { ModuleMeta } from '../meta';
import { ModuleConfig } from '..';

/**
 * How to add a device
 * - Install `@tuyapi/cli` globally
 * - Run `yarn dlx @tuyapi/cli wizard` and follow the instructions
 */

export const Tuya = new (class Meta extends ModuleMeta {
	private _devices: TuyaDevice[] = [];
	public name = 'tuya';

	public init({ modules }: ModuleConfig) {
		this._devices = linkTuyaDevices(modules);
	}

	public async onBackOnline() {
		for (const device of this._devices) {
			await device.refresh();
		}
	}
})();
