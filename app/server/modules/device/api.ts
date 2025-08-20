import type { ResponseLike } from '../../lib/logging/response-logger';
import { errorHandle, auth } from '../../lib/decorators';
import type { Database } from '../../lib/db';
import type { Device } from '.';

interface DeviceInfo {
	id: string;
	status: 'online' | 'offline' | 'unknown';
	lastSeen: number; // timestamp
	name?: string;
}

interface DeviceListResponse {
	devices: DeviceInfo[];
}

export class APIHandler {
	private readonly _db: Database;
	private readonly _device: typeof Device;

	public constructor({
		db,
		device,
	}: {
		db: Database;
		device: typeof Device;
	}) {
		this._db = db;
		this._device = device;
	}

	public updateDeviceStatus(
		onlineDeviceIds: string[],
		previousDeviceIds: string[]
	): void {
		const now = Date.now();
		const knownDevices = this.getStoredDevices();

		// Mark currently online devices
		for (const deviceId of onlineDeviceIds) {
			const device = this._device.getDevice(deviceId);
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

	public getDeviceStatus(deviceId: string): 'online' | 'offline' | 'unknown' {
		const knownDevices = this.getStoredDevices();
		const device = knownDevices[deviceId];

		if (!device) {
			return 'unknown';
		}

		return device.status;
	}

	public getAllKnownDeviceIds(): string[] {
		const knownDevices = this.getStoredDevices();
		return Object.keys(knownDevices);
	}

	private getStoredDevices(): Record<string, DeviceInfo> {
		const devicesJson = this._db.get('device_registry', '{}');
		try {
			return JSON.parse(devicesJson);
		} catch (error) {
			console.error('Error parsing device registry:', error);
			return {};
		}
	}

	@errorHandle
	@auth
	public getDeviceList(res: ResponseLike): DeviceListResponse {
		const currentDeviceIds = this._device.getDeviceIds();
		const knownDevices = this.getStoredDevices();
		const now = Date.now();

		// Update current devices status
		for (const deviceId of currentDeviceIds) {
			knownDevices[deviceId] = {
				id: deviceId,
				status: 'online',
				lastSeen: now,
				name: knownDevices[deviceId]?.name,
			};
		}

		// Create response with all known devices
		const devices: DeviceInfo[] = Object.values(knownDevices).map(
			(device) => ({
				...device,
				status: currentDeviceIds.includes(device.id)
					? 'online'
					: 'offline',
			})
		);

		// Sort by status (online first) then by ID
		devices.sort((a, b) => {
			if (a.status !== b.status) {
				return a.status === 'online' ? -1 : 1;
			}
			return a.id.localeCompare(b.id);
		});

		// Update the database with current status
		const updatedDevices: Record<string, DeviceInfo> = {};
		for (const device of devices) {
			updatedDevices[device.id] = device;
		}
		this._db.setVal('device_registry', JSON.stringify(updatedDevices));

		const response: DeviceListResponse = { devices };

		res.status(200);
		res.write(JSON.stringify(response));
		res.end();
		return response;
	}

	@errorHandle
	@auth
	public updateDeviceName(
		res: ResponseLike,
		{
			deviceId,
			name,
		}: {
			deviceId: string;
			name: string;
		}
	): boolean {
		const knownDevices = this.getStoredDevices();

		if (knownDevices[deviceId]) {
			knownDevices[deviceId].name = name;
			this._db.setVal('device_registry', JSON.stringify(knownDevices));

			res.status(200);
			res.write(JSON.stringify({ success: true }));
			res.end();
			return true;
		}

		res.status(404);
		res.write(JSON.stringify({ error: 'Device not found' }));
		res.end();
		return false;
	}
}
