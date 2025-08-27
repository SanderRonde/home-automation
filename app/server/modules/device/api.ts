import type { Device as DeviceInterface } from './device';
import type { Database } from '../../lib/db';
import type { DeviceInfo } from './routing';

export class DeviceAPI {
	public constructor(private readonly _db: Database) {}

	private _devices: Map<string, DeviceInterface> = new Map();

	public setDevices(devices: DeviceInterface[]): void {
		const currentDeviceIds = new Set(Array.from(this._devices.keys()));
		const newDeviceIds = new Set<string>();

		for (const device of devices) {
			const deviceId = device.getUniqueId();
			const deviceName = device.getDeviceName();
			this._devices.set(deviceId, device);
			newDeviceIds.add(deviceId);

			// Update device name in registry if it has changed
			this.updateDeviceName(deviceId, deviceName);
		}

		// Update database with current device status
		this.updateDeviceStatus(
			Array.from(newDeviceIds),
			Array.from(currentDeviceIds)
		);
	}

	public updateDeviceName(deviceId: string, name: string): boolean {
		const knownDevices = this.getStoredDevices();

		if (knownDevices[deviceId]) {
			knownDevices[deviceId].name = name;
			this._db.setVal('device_registry', JSON.stringify(knownDevices));
			return true;
		}

		return false;
	}

	public getStoredDevices(): Record<string, DeviceInfo> {
		const devicesJson = this._db.get('device_registry', '{}');
		try {
			return JSON.parse(devicesJson);
		} catch (error) {
			console.error('Error parsing device registry:', error);
			return {};
		}
	}

	public updateDeviceStatus(
		onlineDeviceIds: string[],
		previousDeviceIds: string[]
	): void {
		const now = Date.now();
		const knownDevices = this.getStoredDevices();

		// Mark currently online devices
		for (const deviceId of onlineDeviceIds) {
			const device = this.getDevice(deviceId);
			const name = device?.getDeviceName();

			knownDevices[deviceId] = {
				id: deviceId,
				status: 'online',
				lastSeen: now,
				name: name || knownDevices[deviceId]?.name,
			};
		}

		// Mark devices that went offline
		for (const deviceId of previousDeviceIds) {
			if (!onlineDeviceIds.includes(deviceId) && knownDevices[deviceId]) {
				knownDevices[deviceId].status = 'offline';
				// Don't update lastSeen for offline devices
			}
		}

		this._db.setVal('device_registry', JSON.stringify(knownDevices));
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
}
