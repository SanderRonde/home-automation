import type { IncludedIconNames } from '../../../client/dashboard/components/icon';
import { Device as DeviceInterface, DeviceSource } from './device';
import { PowerThresholdTracker } from './power-threshold-tracker';
import { BooleanStateTracker } from './boolean-state-tracker';
import { TemperatureTracker } from './temperature-tracker';
import { IlluminanceTracker } from './illuminance-tracker';
import { OccupancyTracker } from './occupancy-tracker';
import type { DeviceInfo, RoomInfo } from './routing';
import { HumidityTracker } from './humidity-tracker';
import type { DeviceClusterName } from './cluster';
import { SwitchTracker } from './switch-tracker';
import { PowerTracker } from './power-tracker';
import type { Database } from '../../lib/db';
import { PaletteAPI } from './palette-api';
import { CO2Tracker } from './co2-tracker';
import { SceneAPI } from './scene-api';
import { GroupAPI } from './group-api';
import { Data } from '../../lib/data';
import type { DeviceDB } from '.';
import type { SQL } from 'bun';

export class DeviceAPI {
	public readonly occupancyTracker: OccupancyTracker;
	public readonly temperatureTracker: TemperatureTracker;
	public readonly humidityTracker: HumidityTracker;
	public readonly illuminanceTracker: IlluminanceTracker;
	public readonly buttonPressTracker: SwitchTracker;
	public readonly booleanStateTracker: BooleanStateTracker;
	public readonly powerTracker: PowerTracker;
	public readonly powerThresholdTracker: PowerThresholdTracker;
	public readonly co2Tracker: CO2Tracker;
	public readonly paletteAPI: PaletteAPI;
	public readonly sceneAPI: SceneAPI;
	public readonly groupAPI: GroupAPI;

	public constructor(
		private readonly _db: Database<DeviceDB>,
		sqlDB: SQL,
		// Fixes circular dependency
		modules: unknown
	) {
		this.groupAPI = new GroupAPI(_db);
		this.paletteAPI = new PaletteAPI(_db);
		this.sceneAPI = new SceneAPI(
			_db,
			this.devices,
			this.groupAPI,
			this.paletteAPI,
			modules,
			sqlDB
		);
		this.occupancyTracker = new OccupancyTracker(sqlDB, this.sceneAPI);
		this.temperatureTracker = new TemperatureTracker(sqlDB);
		this.humidityTracker = new HumidityTracker(sqlDB);
		// Set modules after initialization to avoid circular dependency
		// This will be called in postInit

		this.illuminanceTracker = new IlluminanceTracker(sqlDB);
		this.buttonPressTracker = new SwitchTracker(sqlDB, this.sceneAPI);
		this.booleanStateTracker = new BooleanStateTracker(sqlDB);
		this.powerTracker = new PowerTracker(sqlDB);
		this.powerThresholdTracker = new PowerThresholdTracker(this.sceneAPI);
		this.co2Tracker = new CO2Tracker(sqlDB);
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

		// Setup tracking for new devices
		this.occupancyTracker.trackDevices(devices);
		this.temperatureTracker.trackDevices(devices);
		this.humidityTracker.trackDevices(devices);
		this.illuminanceTracker.trackDevices(devices);
		this.buttonPressTracker.trackDevices(devices);
		this.booleanStateTracker.trackDevices(devices);
		this.powerTracker.trackDevices(devices);
		this.powerThresholdTracker.trackDevices(devices);
		this.co2Tracker.trackDevices(devices);
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

	public updateDeviceRoom(deviceId: string, room?: string, icon?: IncludedIconNames): boolean {
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

	public updateDevicePosition(
		deviceId: string,
		position: { x: number; y: number } | null
	): boolean {
		const knownDevices = this.getStoredDevices();

		if (knownDevices[deviceId]) {
			if (position === null) {
				delete knownDevices[deviceId].position;
			} else {
				knownDevices[deviceId].position = position;
			}

			this._db.update((old) => ({
				...old,
				device_registry: knownDevices,
			}));
			return true;
		}

		return false;
	}

	public updateDeviceIcon(deviceId: string, icon: IncludedIconNames | null): boolean {
		const knownDevices = this.getStoredDevices();

		if (knownDevices[deviceId]) {
			if (icon === null) {
				delete knownDevices[deviceId].customIcon;
			} else {
				knownDevices[deviceId].customIcon = icon;
			}

			this._db.update((old) => ({
				...old,
				device_registry: knownDevices,
			}));
			return true;
		}

		return false;
	}

	public updateClusterIcon(
		clusterName: DeviceClusterName,
		icon: IncludedIconNames | null
	): boolean {
		const db = this._db.current();
		const clusterIcons = db.cluster_icons || {};
		if (icon) {
			(clusterIcons as Record<DeviceClusterName, IncludedIconNames>)[clusterName] = icon;
		} else {
			delete (clusterIcons as Record<DeviceClusterName, IncludedIconNames>)[clusterName];
		}
		this._db.update((old) => ({
			...old,
			cluster_icons: clusterIcons,
		}));
		return true;
	}

	public getClusterIconOverride(clusterName: DeviceClusterName): IncludedIconNames | undefined {
		const db = this._db.current();
		return (db.cluster_icons as Record<DeviceClusterName, IncludedIconNames> | undefined)?.[
			clusterName
		];
	}

	public getAllClusterIconOverrides(): Record<DeviceClusterName, IncludedIconNames> {
		const db = this._db.current();
		return (db.cluster_icons || {}) as Record<DeviceClusterName, IncludedIconNames>;
	}

	public getRooms(knownDevices: Record<string, DeviceInfo>): Record<string, RoomInfo> {
		const rooms: Record<string, RoomInfo> = {};
		const roomIcons = this._db.current().room_icons || {};
		const roomPolygons = this._db.current().room_polygons || {};

		for (const device of Object.values(knownDevices)) {
			if (device.room) {
				if (!rooms[device.room]) {
					rooms[device.room] = {
						name: device.room,
						color: this.generatePastelColor(device.room),
						icon: roomIcons[device.room],
						polygon: roomPolygons[device.room],
					};
				}
			}
		}

		return rooms;
	}

	public updateRoomPolygon(roomName: string, polygon: Array<{ x: number; y: number }>): void {
		this._db.update((old) => ({
			...old,
			room_polygons: {
				...(old.room_polygons || {}),
				[roomName]: polygon,
			},
		}));
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
		const currentDevices = this.devices.current();

		// Mark currently online devices and extract cluster names
		for (const deviceId of onlineDeviceIds) {
			const device = currentDevices[deviceId];
			const clusterNames: DeviceClusterName[] = device
				? device.allClusters.map(({ cluster }) => cluster.getBaseCluster().clusterName)
				: (knownDevices[deviceId]?.clusterNames ?? []);
			const source = device ? device.getSource().value : knownDevices[deviceId]?.source;

			knownDevices[deviceId] = {
				...knownDevices[deviceId],
				id: deviceId,
				status: 'online',
				lastSeen: now,
				clusterNames,
				source,
			};
		}

		// Mark devices that went offline
		for (const deviceId of previousDeviceIds) {
			if (!onlineDeviceIds.includes(deviceId) && knownDevices[deviceId]) {
				knownDevices[deviceId].status = 'offline';
				// Don't update lastSeen for offline devices
				// Keep clusterNames and source from when device was online
			}
		}

		this._db.update((old) => ({ ...old, device_registry: knownDevices }));
	}
}
