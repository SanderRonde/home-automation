import type { Device as DeviceInterface, DeviceSource } from './device';
import { DeviceOccupancySensingCluster } from './cluster';
import type { DeviceInfo, RoomInfo } from './routing';
import type * as Icons from '@mui/icons-material';
import type { Database } from '../../lib/db';
import { Data } from '../../lib/data';
import type { DeviceDB } from '.';
import type { SQL } from 'bun';

class OccupancyTracker {
	private _subscriptions = new Map<string, () => void>();

	public constructor(private readonly _sqlDB: SQL) {}

	public trackDevices(devices: DeviceInterface[]): void {
		for (const device of devices) {
			const deviceId = device.getUniqueId();

			// Skip if already tracking
			if (this._subscriptions.has(deviceId)) {
				continue;
			}

			// Find occupancy sensing cluster
			const occupancyClusters = device.getAllClustersByType(DeviceOccupancySensingCluster);
			if (!occupancyClusters.length) {
				continue;
			}

			for (const occupancyCluster of occupancyClusters) {
				let lastState: boolean | undefined = undefined;

				// Subscribe to occupancy changes
				const unsubscribe = occupancyCluster.occupancy.subscribe((occupied, isInitial) => {
					if (occupied === undefined) {
						return;
					}
					// Log state changes (but not initial state unless it's occupied)
					if (!isInitial || occupied) {
						if (lastState !== occupied) {
							lastState = occupied;
							void this.logEvent(deviceId, occupied);
						}
					} else {
						lastState = occupied;
					}
				});

				this._subscriptions.set(deviceId, unsubscribe);
			}
		}
	}

	private async logEvent(deviceId: string, occupied: boolean): Promise<void> {
		try {
			await this._sqlDB`
				INSERT INTO occupancy_events (device_id, occupied, timestamp)
				VALUES (${deviceId}, ${occupied ? 1 : 0}, ${Date.now()})
			`;
		} catch (error) {
			console.error(`Failed to log occupancy event for ${deviceId}:`, error);
		}
	}

	public async getHistory(
		deviceId: string,
		limit = 100
	): Promise<Array<{ occupied: boolean; timestamp: number }>> {
		try {
			const results = await this._sqlDB<Array<{ occupied: number; timestamp: number }>>`
				SELECT occupied, timestamp 
				FROM occupancy_events 
				WHERE device_id = ${deviceId}
				ORDER BY timestamp DESC
				LIMIT ${limit}
			`;
			return results.map((r) => ({
				occupied: r.occupied === 1,
				timestamp: r.timestamp,
			}));
		} catch (error) {
			console.error(`Failed to fetch occupancy history for ${deviceId}:`, error);
			return [];
		}
	}

	public async getLastTriggered(deviceId: string): Promise<{ timestamp: number } | null> {
		try {
			const results = await this._sqlDB<
				{
					occupied: number;
					timestamp: number;
				}[]
			>`
				SELECT occupied, timestamp 
				FROM occupancy_events 
				WHERE device_id = ${deviceId}
				AND occupied = 1
				ORDER BY timestamp DESC
				LIMIT 1
			`;
			if (results.length > 0) {
				return {
					timestamp: results[0].timestamp,
				};
			}
		} catch (error) {
			console.error(`Failed to fetch last occupancy event for ${deviceId}:`, error);
		}
		return null;
	}
}

export class DeviceAPI {
	public readonly occupancyTracker: OccupancyTracker;

	public constructor(
		private readonly _db: Database<DeviceDB>,
		sqlDB: SQL
	) {
		this.occupancyTracker = new OccupancyTracker(sqlDB);
	}

	public readonly devices = new Data<{
		[deviceId: string]: DeviceInterface;
	}>({});

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
			newDevices[deviceId] = device;
			newDeviceIds.add(deviceId);
		}

		this.devices.set(newDevices);

		// Update database with current device status
		this.updateDeviceStatus(Array.from(newDeviceIds), Array.from(currentDeviceIds));

		// Setup occupancy tracking for new devices
		this.occupancyTracker.trackDevices(devices);
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

	public updateDeviceRoom(deviceId: string, room?: string, icon?: keyof typeof Icons): boolean {
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
		// Predefined color palette for distinct room colors
		const colorPalette = [
			'#8FB5D6', // Light blue
			'#7DD4A8', // Mint green
			'#A4CD76', // Light green
			'#8B9FDE', // Periwinkle blue
			'#73D1B8', // Turquoise
			'#E8B563', // Golden yellow
			'#D4A5A5', // Dusty rose
			'#B298DC', // Lavender
			'#6ECEB2', // Seafoam
			'#A8D08D', // Sage green
			'#F4A261', // Sandy orange
			'#E07A5F', // Terra cotta
		];

		// Simple hash function to pick from palette
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = name.charCodeAt(i) + ((hash << 5) - hash);
		}

		const index = Math.abs(hash) % colorPalette.length;
		return colorPalette[index];
	}

	public getStoredDevices(): Record<string, DeviceInfo> {
		return this._db.current().device_registry ?? {};
	}

	public updateDeviceStatus(onlineDeviceIds: string[], previousDeviceIds: string[]): void {
		const now = Date.now();
		const knownDevices = { ...this.getStoredDevices() };

		// Mark currently online devices
		for (const deviceId of onlineDeviceIds) {
			knownDevices[deviceId] = {
				...knownDevices[deviceId],
				id: deviceId,
				status: 'online',
				lastSeen: now,
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
