import { linkTuyaDevices } from '../../config/tuya';
import { TuyaDevice } from './devices/device';
import { ModuleMeta } from '../meta';
import { AllModules } from '..';

export const Tuya = new (class Meta extends ModuleMeta {
	private _devices: TuyaDevice[] = [];
	public name = 'tuya';

	public init() {
		return Promise.resolve(void 0);
	}

	public async notifyModules(modules: unknown) {
		this._devices = linkTuyaDevices(modules as AllModules);
		return Promise.resolve(void 0);
	}

	public async onBackOnline() {
		for (const device of this._devices) {
			await device.refresh();
		}
	}
})();
