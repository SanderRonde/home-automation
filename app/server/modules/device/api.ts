import type { Device as DeviceInterface, DeviceSource } from './device';
import type { DeviceInfo, RoomInfo } from './routing';
import type { Database } from '../../lib/db';
import { Data } from '../../lib/data';
import type { DeviceDB } from '.';

export class DeviceAPI {
	public constructor(private readonly _db: Database<DeviceDB>) {}

	public readonly devices = new Data<Record<string, DeviceInterface>>({});

	public setDevices(devices: DeviceInterface[], source: DeviceSource): void {
		const currentDeviceIds = new Set(Object.keys(this.devices.current()));
		const newDeviceIds = new Set<string>();

		const newDevices: Record<string, DeviceInterface> = {};
		for (const device of Object.values(this.devices.current())) {
			// Existing devices with a different source are kept
			if (device.getSource() !== source) {
				newDevices[device.getUniqueId()] = device;
			}
		}
		for (const device of devices) {
			const deviceId = device.getUniqueId();
			const deviceName = device.getDeviceName();
			newDevices[deviceId] = device;
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
			this._db.update((old) => ({
				...old,
				device_registry: knownDevices,
			}));
			return true;
		}

		return false;
	}

	public updateDeviceRoom(
		deviceId: string,
		room?: string,
		icon?: string
	): boolean {
		const knownDevices = this.getStoredDevices();

		if (knownDevices[deviceId]) {
			knownDevices[deviceId].room = room;

			// Update room icon if provided and room exists
			if (room && icon !== undefined) {
				const db = this._db.current();
				const roomIcons = db.room_icons || {};
				if (icon) {
					roomIcons[room] = icon;
				} else {
					delete roomIcons[room];
				}
				this._db.update((old) => ({
					...old,
					device_registry: knownDevices,
					room_icons: roomIcons,
				}));
				return true;
			}

			this._db.update((old) => ({
				...old,
				device_registry: knownDevices,
			}));
			return true;
		}

		return false;
	}

	public getRooms(): Record<string, RoomInfo> {
		const knownDevices = this.getStoredDevices();
		const rooms: Record<string, RoomInfo> = {};
		const roomIcons = this._db.current().room_icons || {};

		for (const device of Object.values(knownDevices)) {
			if (device.room) {
				if (!rooms[device.room]) {
					rooms[device.room] = {
						name: device.room,
						color: this.generatePastelColor(device.room),
						icon: roomIcons[device.room],
					};
				}
			}
		}

		return rooms;
	}

	private generatePastelColor(name: string): string {
		// Simple hash function
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = name.charCodeAt(i) + ((hash << 5) - hash);
		}

		// Generate pastel colors (high lightness, medium saturation)
		const hue = Math.abs(hash % 360);
		const saturation = 45 + (Math.abs(hash >> 8) % 25); // 45-70%
		const lightness = 75 + (Math.abs(hash >> 16) % 15); // 75-90%

		return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
	}

	public getStoredDevices(): Record<string, DeviceInfo> {
		return this._db.current().device_registry ?? {};
	}

	public updateDeviceStatus(
		onlineDeviceIds: string[],
		previousDeviceIds: string[]
	): void {
		const now = Date.now();
		const knownDevices = { ...this.getStoredDevices() };

		// Mark currently online devices
		for (const deviceId of onlineDeviceIds) {
			const device = this.devices.current()[deviceId];
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

		this._db.update((old) => ({ ...old, device_registry: knownDevices }));
	}
}
