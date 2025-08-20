import { ResDummy } from '../../lib/logging/response-logger';
import type { Device as DeviceInterface } from './device';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { APIHandler } from './api';

export const Device = new (class Device extends ModuleMeta {
	private _devices: Map<string, DeviceInterface> = new Map();
	private _apiHandler?: APIHandler;

	public name = 'device';

	public init(config: ModuleConfig<Device>) {
		const { db } = config;
		this._apiHandler = new APIHandler({ db, device: this });

		// Initialize routing
		initRouting({ ...config, apiHandler: this._apiHandler });
	}

	public setDevices(devices: DeviceInterface[]) {
		const currentDeviceIds = new Set(Array.from(this._devices.keys()));
		const newDeviceIds = new Set<string>();

		for (const device of devices) {
			const deviceId = device.getUniqueId();
			const deviceName = device.getDeviceName();
			this._devices.set(deviceId, device);
			newDeviceIds.add(deviceId);

			// Update device name in registry if it has changed
			if (this._apiHandler) {
				void this._apiHandler.updateDeviceName(new ResDummy(), {
					deviceId,
					name: deviceName,
				});
			}
		}

		// Update database with current device status
		if (this._apiHandler) {
			this._apiHandler.updateDeviceStatus(
				Array.from(newDeviceIds),
				Array.from(currentDeviceIds)
			);
		}
	}

	public getDevice(uniqueId: string): DeviceInterface | undefined {
		return this._devices.get(uniqueId);
	}

	public getDevices(): DeviceInterface[] {
		return Array.from(this._devices.values());
	}

	public getDeviceIds(): string[] {
		return Array.from(this._devices.keys());
	}

	public getAllKnownDeviceIds(): string[] {
		return this._apiHandler?.getAllKnownDeviceIds() || [];
	}

	public getDeviceStatus(deviceId: string): 'online' | 'offline' | 'unknown' {
		if (this._devices.has(deviceId)) {
			return 'online';
		}
		return this._apiHandler?.getDeviceStatus(deviceId) || 'unknown';
	}
})();
