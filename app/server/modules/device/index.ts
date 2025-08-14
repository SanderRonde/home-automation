import type { Device as DeviceInterface } from './device';
import { ModuleMeta } from '../meta';

export const Device = new (class Device extends ModuleMeta {
	private _devices: Map<string, DeviceInterface> = new Map();

	public name = 'device';

	public init() {}

	public setDevices(devices: DeviceInterface[]) {
		for (const device of devices) {
			this._devices.set(device.getUniqueId(), device);
		}
	}

	public getDevice(uniqueId: string): DeviceInterface | undefined {
		return this._devices.get(uniqueId);
	}

	public getDevices(): DeviceInterface[] {
		return Array.from(this._devices.values());
	}
})();
