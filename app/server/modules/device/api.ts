import type { Device as DeviceInterface, DeviceSource } from './device';
import type { Database } from '../../lib/db';
import type { DeviceInfo } from './routing';
import { Data } from '../../lib/data';

export class DeviceAPI {
	public constructor(private readonly _db: Database) {}

	public readonly devices = new Data<Map<string, DeviceInterface>>(new Map());

	public setDevices(devices: DeviceInterface[], source: DeviceSource): void {
		const currentDeviceIds = new Set(
			Array.from(this.devices.current().keys())
		);
		const newDeviceIds = new Set<string>();

		const newDevices = new Map<string, DeviceInterface>();
		for (const device of this.devices.current().values()) {
			// Existing devices with a different source are kept
			if (device.getSource() !== source) {
				newDevices.set(device.getUniqueId(), device);
			}
		}
		for (const device of devices) {
			const deviceId = device.getUniqueId();
			const deviceName = device.getDeviceName();
			newDevices.set(deviceId, device);
			newDeviceIds.add(deviceId);

			// Update device name in registry if it has changed
			this.updateDeviceName(deviceId, deviceName);
		}

		this.devices.set(newDevices);

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
			const device = this.devices.current().get(deviceId);
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
}
