import {
	DeviceTemperatureMeasurementCluster,
	DeviceThermostatCluster,
	ThermostatMode,
} from '../device/cluster';
import type { TemperatureScheduleEntry } from './types';
import type { ModuleConfig, AllModules } from '..';
import { logTag } from '../../lib/logging/logger';
import { getController } from './temp-controller';
import { initScheduler } from './scheduler';
import { initRouting } from './routing';
import { ModuleMeta } from '../meta';

export type { TemperatureScheduleEntry } from './types';

type TemperatureSensorConfig = string | { type: 'device'; deviceId: string };

interface TemperatureDB {
	insideTemperatureSensors?: TemperatureSensorConfig[];
	thermostat?: string;
	schedule?: TemperatureScheduleEntry[];
}

interface HistoryEntry {
	timestamp: number;
	action: string;
	details: string;
}

export const Temperature = new (class Temperature extends ModuleMeta {
	public name = 'temperature';
	private _db: ModuleConfig['db'] | null = null;

	private _roomOverrides: Map<string, number> = new Map();
	private _globalOverride: number | null = null;
	private _history: HistoryEntry[] = [];
	private _lastDecision: string = 'Initializing...';
	private _testMode: boolean = false;
	private _virtualThermostat: {
		targetTemperature: number;
		mode: ThermostatMode;
		lastUpdate: number;
	} | null = null;

	public init(config: ModuleConfig) {
		this._db = config.db;

		// Initialize the temperature scheduler
		initScheduler(config.modules);

		return {
			serve: initRouting(config),
		};
	}

	/**
	 * Add an entry to the debug history
	 */
	public addHistoryEntry(action: string, details: string) {
		this._history.unshift({
			timestamp: Date.now(),
			action,
			details,
		});
		// Keep last 50 entries
		if (this._history.length > 50) {
			this._history = this._history.slice(0, 50);
		}
	}

	/**
	 * Set the last decision reason
	 */
	public setLastDecision(decision: string) {
		this._lastDecision = decision;
	}

	/**
	 * Get or set test mode (dry run - doesn't control real thermostats)
	 */
	public getTestMode(): boolean {
		return this._testMode;
	}

	public setTestMode(enabled: boolean): void {
		this._testMode = enabled;
		this.addHistoryEntry(
			'Test Mode',
			enabled
				? 'Test mode ENABLED - no real thermostat control'
				: 'Test mode DISABLED - real thermostat control active'
		);
	}

	/**
	 * Get virtual thermostat state (what would be set in test mode)
	 */
	public getVirtualThermostat() {
		return this._virtualThermostat;
	}

	/**
	 * Set virtual thermostat (for test mode)
	 */
	public setVirtualThermostat(targetTemperature: number, mode: ThermostatMode): void {
		this._virtualThermostat = {
			targetTemperature,
			mode,
			lastUpdate: Date.now(),
		};
	}

	/**
	 * Get debug information
	 */
	public getDebugInfo() {
		const activeSchedule = this.getCurrentActiveSchedule();
		return {
			history: this._history,
			lastDecision: this._lastDecision,
			roomOverrides: Object.fromEntries(this._roomOverrides),
			globalOverride: this._globalOverride,
			activeScheduleName: activeSchedule ? activeSchedule.name : 'None',
			testMode: this._testMode,
			virtualThermostat: this._virtualThermostat,
		};
	}

	/**
	 * Set a manual temperature override for a room
	 */
	public setRoomOverride(roomName: string, temperature: number | null): void {
		if (temperature === null) {
			this._roomOverrides.delete(roomName);
			this.addHistoryEntry('Clear Override', `Cleared override for room ${roomName}`);
		} else {
			this._roomOverrides.set(roomName, temperature);
			this.addHistoryEntry(
				'Set Override',
				`Set override for room ${roomName} to ${temperature}°C`
			);
		}
	}

	/**
	 * Set a global manual temperature override
	 */
	public setGlobalOverride(temperature: number | null): void {
		this._globalOverride = temperature;
		this.addHistoryEntry(
			'Set Global Override',
			temperature ? `Set global override to ${temperature}°C` : 'Cleared global override'
		);
	}

	/**
	 * Get the global target temperature
	 */
	public getGlobalTarget(): number {
		if (this._globalOverride !== null) {
			return this._globalOverride;
		}
		const activeSchedule = this.getCurrentActiveSchedule();
		return activeSchedule ? activeSchedule.targetTemperature : 15;
	}

	/**
	 * Get the target temperature for a room based on:
	 * 1. Manual override
	 * 2. Schedule exception
	 * 3. Schedule global target (or global override)
	 */
	public getRoomTarget(roomName: string): number {
		if (this._roomOverrides.has(roomName)) {
			return this._roomOverrides.get(roomName)!;
		}

		if (this._globalOverride !== null) {
			return this._globalOverride;
		}

		const activeSchedule = this.getCurrentActiveSchedule();
		if (!activeSchedule) {
			return 15;
		}

		if (activeSchedule.roomExceptions?.[roomName] !== undefined) {
			return activeSchedule.roomExceptions[roomName];
		}

		return activeSchedule.targetTemperature;
	}

	/**
	 * Get the status of a specific room
	 * @param centralThermostatHeating - Optional: whether the central thermostat is actively heating.
	 *                                   If provided, isHeating will be true only if the room needs
	 *                                   heating AND the central thermostat is on.
	 */
	public async getRoomStatus(
		modules: AllModules,
		roomName: string,
		centralThermostatHeating?: boolean
	): Promise<{
		name: string;
		currentTemperature: number;
		targetTemperature: number;
		isHeating: boolean;
		needsHeating: boolean;
		overrideActive: boolean;
	}> {
		const targetTemperature = this.getRoomTarget(roomName);
		let currentTemperature = 0;

		// Get current temperature for the room
		const deviceApi = await modules.device.api.value;
		const storedDevices = deviceApi.getStoredDevices();
		const allDevices = deviceApi.devices.current();

		const temps: number[] = [];

		for (const deviceId in allDevices) {
			const device = allDevices[deviceId];
			const storedInfo = storedDevices[deviceId];

			if (storedInfo?.room !== roomName) {
				continue;
			}

			const clusters = device.getAllClustersByType(DeviceTemperatureMeasurementCluster);
			for (const cluster of clusters) {
				const temp = await cluster.temperature.get();
				if (temp !== undefined && !Number.isNaN(temp)) {
					temps.push(temp);
				}
			}
		}

		if (temps.length > 0) {
			currentTemperature = temps.reduce((a, b) => a + b, 0) / temps.length;
		} else {
			// Fallback to central thermostat temp or default if no sensors in room
			currentTemperature = 0;
		}

		// Check if room has TRVs (excluding central thermostat)
		// Rooms without TRVs cannot be heated, so they should not demand heating
		const centralThermostatId = this.getThermostat();
		let hasTRV = false;

		for (const deviceId in allDevices) {
			// Skip the central thermostat - it's controlled separately
			if (deviceId === centralThermostatId) {
				continue;
			}

			const storedInfo = storedDevices[deviceId];
			if (storedInfo?.room !== roomName) {
				continue;
			}

			const device = allDevices[deviceId];
			const thermostatClusters = device.getAllClustersByType(DeviceThermostatCluster);
			if (thermostatClusters.length > 0) {
				hasTRV = true;
				break;
			}
		}

		// Room needs heating if it has:
		// 1. A temperature sensor (currentTemperature > 0)
		// 2. Current temp is meaningfully below target (0.5°C threshold)
		// 3. At least one TRV to actually control heating
		// Use 0.5°C threshold - only enable heating if current temp is >= 0.5°C below target
		const needsHeating =
			hasTRV && currentTemperature > 0 && currentTemperature < targetTemperature - 0.5;

		// Room is actively heating if it needs heating AND the central thermostat is on
		// (i.e., TRV is set to 30 and boiler is running)
		const isHeating =
			centralThermostatHeating !== undefined
				? needsHeating && centralThermostatHeating
				: needsHeating;

		return {
			name: roomName,
			currentTemperature,
			targetTemperature,
			isHeating,
			needsHeating,
			overrideActive: this._roomOverrides.has(roomName),
		};
	}

	/**
	 * Get status for all configured rooms
	 */
	public async getAllRoomsStatus(modules: AllModules): Promise<
		Array<{
			name: string;
			currentTemperature: number;
			targetTemperature: number;
			isHeating: boolean;
			needsHeating: boolean;
			overrideActive: boolean;
		}>
	> {
		const deviceApi = await modules.device.api.value;
		const rooms = deviceApi.getRooms();
		const roomNames = Object.keys(rooms);

		// Get central thermostat status to determine if boiler is actually on
		const centralStatus = await this.getCentralThermostatStatus(modules);
		const centralThermostatHeating = centralStatus?.isHeating ?? false;

		const statuses = await Promise.all(
			roomNames.map((name) => this.getRoomStatus(modules, name, centralThermostatHeating))
		);

		return statuses;
	}

	/**
	 * Get the average target temperature across all rooms (current)
	 */
	public async getAverageTargetTemperature(modules: AllModules): Promise<number> {
		const statuses = await this.getAllRoomsStatus(modules);
		if (statuses.length === 0) {
			return 0;
		}

		const sum = statuses.reduce((acc, s) => acc + s.targetTemperature, 0);
		return sum / statuses.length;
	}

	/**
	 * Get the average target temperature for the NEXT schedule
	 */
	public async getNextAverageTargetTemperature(modules: AllModules): Promise<number> {
		const nextChange = this.getNextScheduledChange();
		if (!nextChange) {
			return 0;
		}

		const { entry } = nextChange;
		const deviceApi = await modules.device.api.value;
		const rooms = deviceApi.getRooms();
		const roomNames = Object.keys(rooms);

		if (roomNames.length === 0) {
			return entry.targetTemperature;
		}

		let sum = 0;
		for (const roomName of roomNames) {
			if (entry.roomExceptions?.[roomName] !== undefined) {
				sum += entry.roomExceptions[roomName];
			} else {
				sum += entry.targetTemperature;
			}
		}

		return sum / roomNames.length;
	}

	public async getTemp(name: string) {
		const controller = await getController(await this._sqlDB.value, name);
		return controller.getLastTemp();
	}

	/**
	 * Get the configured inside temperature sensors from the database
	 */
	public getInsideTemperatureSensors(): TemperatureSensorConfig[] {
		if (!this._db) {
			return [];
		}
		const data = this._db.current() as TemperatureDB;
		return data.insideTemperatureSensors ?? [];
	}

	/**
	 * Get the configured central thermostat device ID from the database
	 */
	public getThermostat(): string | undefined {
		if (!this._db) {
			return undefined;
		}
		const data = this._db.current() as TemperatureDB;
		return data.thermostat;
	}

	/**
	 * Get the configured temperature schedule from the database
	 */
	public getSchedule(): TemperatureScheduleEntry[] {
		if (!this._db) {
			return [];
		}
		const data = this._db.current() as TemperatureDB;
		return data.schedule ?? [];
	}

	/**
	 * Save the temperature schedule to the database
	 */
	public setSchedule(schedule: TemperatureScheduleEntry[]): void {
		if (!this._db) {
			return;
		}
		this._db.update((old) => ({
			...old,
			schedule,
		}));
		this.addHistoryEntry('Update Schedule', 'Updated temperature schedule');
	}

	/**
	 * Get the next scheduled temperature change
	 * Returns the next schedule entry that will trigger, along with when it triggers
	 */
	public getNextScheduledChange(): {
		entry: TemperatureScheduleEntry;
		nextTriggerTime: Date;
	} | null {
		const schedule = this.getSchedule();
		const enabledSchedules = schedule.filter((s) => s.enabled);

		if (enabledSchedules.length === 0) {
			return null;
		}

		const now = new Date();
		const currentDay = now.getDay();
		const currentMinutes = now.getHours() * 60 + now.getMinutes();

		let closestEntry: TemperatureScheduleEntry | null = null;
		let closestTime: Date | null = null;
		let minDiff = Infinity;

		// Check up to 7 days ahead
		for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
			const checkDay = (currentDay + dayOffset) % 7;
			const checkDate = new Date(now);
			checkDate.setDate(checkDate.getDate() + dayOffset);

			for (const entry of enabledSchedules) {
				if (!entry.days.includes(checkDay)) {
					continue;
				}

				const [startHour, startMinute] = entry.startTime.split(':').map(Number);
				const startMinutes = startHour * 60 + startMinute;

				// Calculate time until this schedule triggers
				let diff: number;
				if (dayOffset === 0) {
					// Same day
					if (startMinutes > currentMinutes) {
						diff = startMinutes - currentMinutes;
					} else {
						continue; // Already passed today
					}
				} else {
					// Future day
					diff = dayOffset * 24 * 60 - currentMinutes + startMinutes;
				}

				if (diff < minDiff) {
					minDiff = diff;
					closestEntry = entry;
					closestTime = new Date(checkDate);
					closestTime.setHours(startHour, startMinute, 0, 0);
				}
			}
		}

		if (closestEntry && closestTime) {
			return {
				entry: closestEntry,
				nextTriggerTime: closestTime,
			};
		}

		return null;
	}

	/**
	 * Get the currently active schedule entry (if any)
	 */
	public getCurrentActiveSchedule(): TemperatureScheduleEntry | null {
		const schedule = this.getSchedule();
		const enabledSchedules = schedule.filter((s) => s.enabled);

		if (enabledSchedules.length === 0) {
			return null;
		}

		const now = new Date();
		const currentDay = now.getDay();
		const currentMinutes = now.getHours() * 60 + now.getMinutes();

		for (const entry of enabledSchedules) {
			if (!entry.days.includes(currentDay)) {
				continue;
			}

			const [startHour, startMinute] = entry.startTime.split(':').map(Number);
			const [endHour, endMinute] = entry.endTime.split(':').map(Number);
			const startMinutes = startHour * 60 + startMinute;
			const endMinutes = endHour * 60 + endMinute;

			// Handle schedules that cross midnight
			if (endMinutes <= startMinutes) {
				// Schedule crosses midnight
				if (currentMinutes >= startMinutes || currentMinutes < endMinutes) {
					return entry;
				}
			} else {
				// Normal schedule within same day
				if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
					return entry;
				}
			}
		}

		return null;
	}

	/**
	 * Get inside temperature from configured sensors, with averaging support
	 */
	public async getInsideTemperature(modules: AllModules): Promise<number> {
		const sensors = this.getInsideTemperatureSensors();

		// Fallback to 'room' if no sensors configured
		if (sensors.length === 0) {
			return await this.getTemp('room');
		}

		const temperatures: number[] = [];

		for (const sensor of sensors) {
			try {
				if (typeof sensor === 'string') {
					// Temperature module controller
					const temp = await this.getTemp(sensor);
					if (temp > -1) {
						// Valid temperature (getTemp returns -1 if not initialized)
						temperatures.push(temp);
					}
				} else if (sensor.type === 'device' && sensor.deviceId) {
					// Device module sensor
					const deviceApi = await modules.device.api.value;
					const devices = deviceApi.devices.current();
					const device = devices[sensor.deviceId];

					if (device) {
						const temperatureClusters = device.getAllClustersByType(
							DeviceTemperatureMeasurementCluster
						);
						if (temperatureClusters.length > 0) {
							const temperature = await temperatureClusters[0].temperature.get();
							if (temperature !== undefined && !Number.isNaN(temperature)) {
								temperatures.push(temperature);
							}
						}
					}
				}
			} catch (error) {
				// Skip invalid sensors
				logTag(
					'temperature',
					'yellow',
					`Failed to get temperature from sensor: ${JSON.stringify(sensor)}`,
					error
				);
			}
		}

		// If no valid temperatures found, fallback to 'room'
		if (temperatures.length === 0) {
			return await this.getTemp('room');
		}

		// Calculate average
		const sum = temperatures.reduce((acc, temp) => acc + temp, 0);
		return sum / temperatures.length;
	}

	/**
	 * Get average temperature from ALL devices with temperature sensors in the house
	 */
	public async getAllDeviceTemperaturesAverage(modules: AllModules): Promise<number> {
		const temperatures: number[] = [];

		try {
			const deviceApi = await modules.device.api.value;
			const devices = deviceApi.devices.current();

			// Iterate through all devices to find temperature sensors
			for (const [deviceId, deviceValue] of Object.entries(devices)) {
				if (!deviceValue) {
					continue;
				}
				const device = deviceValue;

				try {
					const temperatureClusters = device.getAllClustersByType(
						DeviceTemperatureMeasurementCluster
					);

					for (const cluster of temperatureClusters) {
						const temperature = await cluster.temperature.get();
						if (temperature !== undefined && !Number.isNaN(temperature)) {
							temperatures.push(temperature);
						}
					}
				} catch (error) {
					// Skip devices that fail to read temperature
					logTag(
						'temperature',
						'yellow',
						`Failed to get temperature from device: ${deviceId}`,
						error
					);
				}
			}
		} catch (error) {
			logTag('temperature', 'red', 'Failed to get devices for temperature averaging:', error);
		}

		// If no valid temperatures found, fallback to 'room'
		if (temperatures.length === 0) {
			return await this.getTemp('room');
		}

		// Calculate average
		const sum = temperatures.reduce((acc, temp) => acc + temp, 0);
		return sum / temperatures.length;
	}

	/**
	 * Get list of available temperature sensors
	 */
	public async getAvailableTemperatureSensors(
		modules: AllModules,
		sqlDB: ModuleConfig['sqlDB']
	): Promise<{
		temperatureControllers: string[];
		deviceSensors: Array<{ deviceId: string; name: string }>;
	}> {
		// Get temperature controllers from SQLite database
		const temperatureControllers: string[] = [];
		try {
			const locations = await sqlDB<{ location: string }[]>`
				SELECT DISTINCT location FROM temperatures ORDER BY location
			`;
			temperatureControllers.push(...locations.map((row) => row.location));
		} catch {
			// Table might not exist yet, that's okay
		}

		// Get device sensors
		const deviceSensors: Array<{ deviceId: string; name: string }> = [];
		try {
			const deviceApi = await modules.device.api.value;
			const devices = deviceApi.devices.current();

			for (const [deviceId, deviceValue] of Object.entries(devices)) {
				if (!deviceValue) {
					continue;
				}
				const device = deviceValue;
				const temperatureClusters = device.getAllClustersByType(
					DeviceTemperatureMeasurementCluster
				);
				if (temperatureClusters.length > 0) {
					const name = await device.getDeviceName();
					deviceSensors.push({ deviceId, name });
				}
			}
		} catch {
			// Device module might not be available
		}

		return {
			temperatureControllers,
			deviceSensors,
		};
	}

	/**
	 * Get list of available thermostats (devices with thermostat clusters)
	 */
	public async getAvailableThermostats(
		modules: AllModules
	): Promise<Array<{ deviceId: string; name: string }>> {
		const thermostats: Array<{ deviceId: string; name: string }> = [];
		try {
			const deviceApi = await modules.device.api.value;
			const devices = deviceApi.devices.current();

			for (const [deviceId, deviceValue] of Object.entries(devices)) {
				if (!deviceValue) {
					continue;
				}
				const device = deviceValue;
				const thermostatClusters = device.getAllClustersByType(DeviceThermostatCluster);
				if (thermostatClusters.length > 0) {
					const name = await device.getDeviceName();
					thermostats.push({ deviceId, name });
				}
			}
		} catch {
			// Device module might not be available
		}

		return thermostats;
	}

	/**
	 * Get the status of the configured central thermostat
	 */
	public async getCentralThermostatStatus(modules: AllModules): Promise<{
		deviceId: string;
		currentTemperature: number;
		targetTemperature: number;
		isHeating: boolean;
		mode: ThermostatMode;
	} | null> {
		const thermostatId = this.getThermostat();
		if (!thermostatId) {
			return null;
		}

		try {
			const deviceApi = await modules.device.api.value;
			const devices = deviceApi.devices.current();
			const device = devices[thermostatId];

			if (!device) {
				return null;
			}

			const thermostatClusters = device.getAllClustersByType(DeviceThermostatCluster);
			if (thermostatClusters.length === 0) {
				return null;
			}

			const cluster = thermostatClusters[0];
			const currentTemperature = (await cluster.currentTemperature.get()) ?? 20;
			const targetTemperature = (await cluster.targetTemperature.get()) ?? 20;
			const isHeating = (await cluster.isHeating.get()) ?? false;
			const mode = (await cluster.mode.get()) ?? ThermostatMode.OFF;

			return {
				deviceId: thermostatId,
				currentTemperature,
				targetTemperature,
				isHeating,
				mode,
			};
		} catch (error) {
			logTag(
				'temperature',
				'yellow',
				`Failed to get central thermostat status: ${thermostatId}`,
				error
			);
			return null;
		}
	}

	/**
	 * Set the target temperature on the central thermostat hardware (switch to manual mode)
	 * NOTE: This controls the physical device, not the logical schedule.
	 * In test mode, this only updates the virtual thermostat state.
	 */
	public async setThermostatHardwareTarget(
		modules: AllModules,
		targetTemperature: number
	): Promise<boolean> {
		// In test mode, only update virtual thermostat
		if (this._testMode) {
			this.setVirtualThermostat(targetTemperature, ThermostatMode.MANUAL);
			logTag(
				'temperature',
				'yellow',
				`[TEST MODE] Would set central thermostat to ${targetTemperature}°C (manual mode)`
			);
			this.addHistoryEntry(
				'Thermostat Action (TEST)',
				`Would set central thermostat to ${targetTemperature}°C (TEST MODE - not applied)`
			);
			return true;
		}

		const thermostatId = this.getThermostat();
		if (!thermostatId) {
			return false;
		}

		try {
			const deviceApi = await modules.device.api.value;
			const devices = deviceApi.devices.current();
			const device = devices[thermostatId];

			if (!device) {
				return false;
			}

			const thermostatClusters = device.getAllClustersByType(DeviceThermostatCluster);
			if (thermostatClusters.length === 0) {
				return false;
			}

			const cluster = thermostatClusters[0];
			await cluster.setTargetTemperature(targetTemperature);
			await cluster.setMode(ThermostatMode.MANUAL);

			logTag(
				'temperature',
				'green',
				`Set central thermostat hardware target to ${targetTemperature}°C (manual mode)`
			);
			this.addHistoryEntry(
				'Thermostat Action',
				`Set central thermostat to ${targetTemperature}°C`
			);
			return true;
		} catch (error) {
			logTag(
				'temperature',
				'red',
				`Failed to set central thermostat hardware target: ${thermostatId}`,
				error
			);
			this.addHistoryEntry(
				'Thermostat Error',
				`Failed to set central thermostat: ${String(error)}`
			);
			return false;
		}
	}

	/**
	 * Set target temperature on all TRV devices in a specific room.
	 * TRVs are set to 30°C when heating is needed, or 15°C when not,
	 * to force them fully open or closed (bypassing their own control logic).
	 */
	public async setRoomTRVTargets(
		modules: AllModules,
		roomName: string,
		needsHeating: boolean
	): Promise<void> {
		const targetTemp = needsHeating ? 30 : 15;

		try {
			const deviceApi = await modules.device.api.value;
			const storedDevices = deviceApi.getStoredDevices();
			const allDevices = deviceApi.devices.current();

			// Find all thermostat/TRV devices in this room (excluding the central thermostat)
			const centralThermostatId = this.getThermostat();

			for (const deviceId in allDevices) {
				// Skip the central thermostat - it's controlled separately
				if (deviceId === centralThermostatId) {
					continue;
				}

				const storedInfo = storedDevices[deviceId];
				if (storedInfo?.room !== roomName) {
					continue;
				}

				const device = allDevices[deviceId];
				const thermostatClusters = device.getAllClustersByType(DeviceThermostatCluster);

				for (const cluster of thermostatClusters) {
					try {
						const currentTarget = await cluster.targetTemperature.get();

						// Only update if different
						if (currentTarget !== targetTemp) {
							if (this._testMode) {
								logTag(
									'temperature',
									'yellow',
									`[TEST MODE] Would set TRV ${storedInfo.name} in ${roomName} to ${targetTemp}°C`
								);
							} else {
								await cluster.setTargetTemperature(targetTemp);
								logTag(
									'temperature',
									needsHeating ? 'green' : 'blue',
									`Set TRV ${storedInfo.name} in ${roomName} to ${targetTemp}°C`
								);
							}
						}
					} catch (error) {
						logTag(
							'temperature',
							'red',
							`Failed to set TRV target for ${storedInfo.name}:`,
							error
						);
					}
				}
			}
		} catch (error) {
			logTag('temperature', 'red', `Failed to update TRVs in room ${roomName}:`, error);
		}
	}

	/**
	 * Update all room TRVs based on current heating demand.
	 * Each room's TRVs are set to 30°C if that room needs heating, or 15°C if not.
	 */
	public async updateAllRoomTRVs(
		modules: AllModules,
		roomStatuses: Array<{ name: string; isHeating: boolean }>
	): Promise<void> {
		await Promise.all(
			roomStatuses.map((room) => this.setRoomTRVTargets(modules, room.name, room.isHeating))
		);
	}
})();
