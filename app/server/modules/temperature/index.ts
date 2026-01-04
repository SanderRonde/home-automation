import {
	DeviceTemperatureMeasurementCluster,
	DeviceThermostatCluster,
	ThermostatMode,
} from '../device/cluster';
import type {
	TemperatureScheduleEntry,
	TemperatureState,
	PIDParameters,
	MeasurementSession,
} from './types';
import { PIDMeasurementManager } from './pid-measurement';
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
	schedule?: TemperatureScheduleEntry[]; // Legacy - for migration
	states?: TemperatureState[];
	activeStateId?: string | null; // Scene-activated state (null = use time-based default)
	roomOvershoot?: Record<string, number>; // Per-room overshoot in °C (default: 0.5)
	roomPIDParameters?: Record<string, import('./types').PIDParameters>;
}

interface HistoryEntry {
	timestamp: number;
	action: string;
	details: string;
}

export const Temperature = new (class Temperature extends ModuleMeta {
	public name = 'temperature';
	private _db: ModuleConfig['db'] | null = null;
	private _pidManager: PIDMeasurementManager | null = null;

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
		this._pidManager = new PIDMeasurementManager(config.modules, config.db);

		// Migrate old schedule format to states if needed
		this._migrateScheduleToStates();

		// Initialize the temperature scheduler
		initScheduler(config.modules);

		return {
			serve: initRouting(config),
		};
	}

	/**
	 * Migrate old schedule format to new states format
	 */
	private _migrateScheduleToStates(): void {
		if (!this._db) {
			return;
		}

		const data = this._db.current() as TemperatureDB;

		// If states already exist, no migration needed
		if (data.states && data.states.length > 0) {
			return;
		}

		// If no old schedule exists, create empty states array
		if (!data.schedule || data.schedule.length === 0) {
			this._db.update((old) => ({
				...(old as TemperatureDB),
				states: [],
			}));
			return;
		}

		// Migrate: Create a default state with all existing schedule entries
		const defaultState: TemperatureState = {
			id: 'default',
			name: 'Default',
			timeRanges: data.schedule,
			isDefault: true,
		};

		this._db.update((old) => {
			const oldData = old as TemperatureDB;
			return {
				...oldData,
				states: [defaultState],
				// Keep schedule for backward compatibility during transition
			};
		});

		logTag(
			'temperature',
			'blue',
			`Migrated ${data.schedule.length} schedule entries to default state`
		);
		this.addHistoryEntry(
			'Migration',
			`Migrated ${data.schedule.length} schedule entries to default state`
		);
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
		const activeState = this.getActiveState();
		const data = this._db?.current() as TemperatureDB | undefined;
		const activeStateId = data?.activeStateId;
		return {
			history: this._history,
			lastDecision: this._lastDecision,
			roomOverrides: Object.fromEntries(this._roomOverrides),
			globalOverride: this._globalOverride,
			activeScheduleName: activeSchedule ? activeSchedule.name : 'None',
			activeStateId: activeStateId ?? null,
			activeStateName: activeState ? activeState.name : 'None',
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
	 * Get the overshoot value for a room (how much above target before stopping heating)
	 * Defaults to 0.5°C if not configured
	 */
	public getRoomOvershoot(roomName: string): number {
		if (!this._db) {
			return 0.5; // Default overshoot
		}
		const data = this._db.current() as TemperatureDB;
		return data.roomOvershoot?.[roomName] ?? 0.5;
	}

	/**
	 * Set the overshoot value for a room
	 */
	public setRoomOvershoot(roomName: string, overshoot: number | null): void {
		if (!this._db) {
			return;
		}
		this._db.update((old) => {
			const data = old as TemperatureDB;
			const roomOvershoot = { ...(data.roomOvershoot || {}) };
			if (overshoot === null) {
				delete roomOvershoot[roomName];
			} else {
				roomOvershoot[roomName] = overshoot;
			}
			return {
				...data,
				roomOvershoot,
			};
		});
		this.addHistoryEntry(
			'Set Room Overshoot',
			overshoot === null
				? `Cleared overshoot for room ${roomName} (using default 0.5°C)`
				: `Set overshoot for room ${roomName} to ${overshoot}°C`
		);
	}

	/**
	 * Get all room overshoot configurations
	 */
	public getAllRoomOvershoots(): Record<string, number> {
		if (!this._db) {
			return {};
		}
		const data = this._db.current() as TemperatureDB;
		return data.roomOvershoot || {};
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
		pidMeasurementActive?: boolean;
		pidParametersAvailable?: boolean;
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

		// Check if PID measurement is active for this room
		const pidMeasurementActive = this.isPIDMeasurementActiveForRoom(roomName);

		// Check if PID parameters are available
		const pidParameters = this.getPIDParameters(roomName);
		const pidParametersAvailable = pidParameters !== null;

		// Calculate needsHeating: use PID early stop if available, otherwise use dumb mode
		let needsHeating: boolean;
		if (pidParameters && !pidMeasurementActive) {
			// PID mode: use early stop temperature
			const earlyStopTemp = this.calculateEarlyStopTemperature(
				roomName,
				currentTemperature,
				targetTemperature
			);
			if (earlyStopTemp !== null) {
				// Use early stop temperature with 0.5°C hysteresis
				needsHeating =
					hasTRV && currentTemperature > 0 && currentTemperature < earlyStopTemp - 0.5;
			} else {
				// Fallback to dumb mode
				const overshoot = this.getRoomOvershoot(roomName);
				needsHeating =
					hasTRV &&
					currentTemperature > 0 &&
					currentTemperature < targetTemperature - 0.5 &&
					currentTemperature < targetTemperature + overshoot;
			}
		} else {
			// Dumb mode: use target temperature with overshoot
			const overshoot = this.getRoomOvershoot(roomName);
			needsHeating =
				hasTRV &&
				currentTemperature > 0 &&
				currentTemperature < targetTemperature - 0.5 &&
				currentTemperature < targetTemperature + overshoot;
		}

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
			pidMeasurementActive,
			pidParametersAvailable,
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
			pidMeasurementActive?: boolean;
			pidParametersAvailable?: boolean;
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
	 * Get all temperature states
	 */
	public getStates(): TemperatureState[] {
		if (!this._db) {
			return [];
		}
		const data = this._db.current() as TemperatureDB;
		return data.states ?? [];
	}

	/**
	 * Get a specific temperature state by ID
	 */
	public getState(stateId: string): TemperatureState | null {
		const states = this.getStates();
		return states.find((s) => s.id === stateId) ?? null;
	}

	/**
	 * Get the default state (for time-based fallback)
	 */
	public getDefaultState(): TemperatureState | null {
		const states = this.getStates();
		return states.find((s) => s.isDefault) ?? states[0] ?? null;
	}

	/**
	 * Get the currently active state (scene-activated or default)
	 */
	public getActiveState(): TemperatureState | null {
		if (!this._db) {
			return null;
		}
		const data = this._db.current() as TemperatureDB;
		const activeStateId = data.activeStateId;

		if (activeStateId !== null && activeStateId !== undefined) {
			// Scene-activated state
			const state = this.getState(activeStateId);
			if (state) {
				return state;
			}
		}

		// Fall back to default state (time-based)
		return this.getDefaultState();
	}

	/**
	 * Set all temperature states
	 */
	public setStates(states: TemperatureState[]): void {
		if (!this._db) {
			return;
		}
		this._db.update((old) => ({
			...(old as TemperatureDB),
			states,
		}));
		this.addHistoryEntry('Update States', 'Updated temperature states');
	}

	/**
	 * Update a specific state
	 */
	public updateState(stateId: string, updates: Partial<TemperatureState>): void {
		if (!this._db) {
			return;
		}
		const states = this.getStates();
		const index = states.findIndex((s) => s.id === stateId);
		if (index === -1) {
			return;
		}
		const updatedStates = [...states];
		updatedStates[index] = { ...updatedStates[index], ...updates };
		this.setStates(updatedStates);
		this.addHistoryEntry('Update State', `Updated state ${stateId}`);
	}

	/**
	 * Activate a state (via scene). Set to null to return to time-based default.
	 */
	public activateState(stateId: string | null): void {
		if (!this._db) {
			return;
		}
		this._db.update((old) => ({
			...(old as TemperatureDB),
			activeStateId: stateId,
		}));
		if (stateId === null) {
			this.addHistoryEntry('State Activation', 'Returned to time-based schedule');
		} else {
			const state = this.getState(stateId);
			const stateName = state ? state.name : stateId;
			this.addHistoryEntry('State Activation', `Activated state: ${stateName}`);
		}
	}

	/**
	 * Get the configured temperature schedule from the database (legacy - for backward compatibility)
	 * Returns time ranges from the default state
	 */
	public getSchedule(): TemperatureScheduleEntry[] {
		const defaultState = this.getDefaultState();
		return defaultState?.timeRanges ?? [];
	}

	/**
	 * Save the temperature schedule to the database (legacy - for backward compatibility)
	 * Updates the default state's time ranges
	 */
	public setSchedule(schedule: TemperatureScheduleEntry[]): void {
		const defaultState = this.getDefaultState();
		if (defaultState) {
			this.updateState(defaultState.id, { timeRanges: schedule });
		} else {
			// Create default state if it doesn't exist
			const newState: TemperatureState = {
				id: 'default',
				name: 'Default',
				timeRanges: schedule,
				isDefault: true,
			};
			const states = this.getStates();
			this.setStates([...states, newState]);
		}
	}

	/**
	 * Get the next scheduled temperature change
	 * Returns the next schedule entry (time range) that will trigger, along with when it triggers
	 * Uses the active state (scene-activated or default)
	 */
	public getNextScheduledChange(): {
		entry: TemperatureScheduleEntry;
		nextTriggerTime: Date;
	} | null {
		const activeState = this.getActiveState();
		if (!activeState) {
			return null;
		}

		const enabledRanges = activeState.timeRanges.filter((r) => r.enabled);
		if (enabledRanges.length === 0) {
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

			for (const range of enabledRanges) {
				if (!range.days.includes(checkDay)) {
					continue;
				}

				const [startHour, startMinute] = range.startTime.split(':').map(Number);
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
					closestEntry = range;
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
	 * Get the currently active schedule entry (time range) from the active state
	 */
	public getCurrentActiveSchedule(): TemperatureScheduleEntry | null {
		const activeState = this.getActiveState();
		if (!activeState) {
			return null;
		}

		const enabledRanges = activeState.timeRanges.filter((r) => r.enabled);
		if (enabledRanges.length === 0) {
			return null;
		}

		const now = new Date();
		const currentDay = now.getDay();
		const currentMinutes = now.getHours() * 60 + now.getMinutes();

		for (const range of enabledRanges) {
			if (!range.days.includes(currentDay)) {
				continue;
			}

			const [startHour, startMinute] = range.startTime.split(':').map(Number);
			const [endHour, endMinute] = range.endTime.split(':').map(Number);
			const startMinutes = startHour * 60 + startMinute;
			const endMinutes = endHour * 60 + endMinute;

			// Handle schedules that cross midnight
			if (endMinutes <= startMinutes) {
				// Schedule crosses midnight
				if (currentMinutes >= startMinutes || currentMinutes < endMinutes) {
					return range;
				}
			} else {
				// Normal schedule within same day
				if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
					return range;
				}
			}
		}

		return null;
	}

	/**
	 * Get the active schedule entry (time range) for a specific timestamp
	 * Uses the active state (scene-activated or default)
	 */
	public getActiveScheduleForTimestamp(timestamp: number): TemperatureScheduleEntry | null {
		const activeState = this.getActiveState();
		if (!activeState) {
			return null;
		}

		const enabledRanges = activeState.timeRanges.filter((r) => r.enabled);
		if (enabledRanges.length === 0) {
			return null;
		}

		const date = new Date(timestamp);
		const day = date.getDay();
		const minutes = date.getHours() * 60 + date.getMinutes();

		for (const range of enabledRanges) {
			if (!range.days.includes(day)) {
				continue;
			}

			const [startHour, startMinute] = range.startTime.split(':').map(Number);
			const [endHour, endMinute] = range.endTime.split(':').map(Number);
			const startMinutes = startHour * 60 + startMinute;
			const endMinutes = endHour * 60 + endMinute;

			// Handle schedules that cross midnight
			if (endMinutes <= startMinutes) {
				// Schedule crosses midnight
				if (minutes >= startMinutes || minutes < endMinutes) {
					return range;
				}
			} else {
				// Normal schedule within same day
				if (minutes >= startMinutes && minutes < endMinutes) {
					return range;
				}
			}
		}

		return null;
	}

	/**
	 * Get the target temperature for a room at a specific timestamp
	 * Note: This uses current overrides if they exist, otherwise calculates from schedule
	 */
	public getRoomTargetForTimestamp(roomName: string, timestamp: number): number {
		// Use current room override if it exists (we can't know historical overrides)
		if (this._roomOverrides.has(roomName)) {
			return this._roomOverrides.get(roomName)!;
		}

		// Use current global override if it exists
		if (this._globalOverride !== null) {
			return this._globalOverride;
		}

		// Calculate from schedule at that timestamp
		const activeSchedule = this.getActiveScheduleForTimestamp(timestamp);
		if (!activeSchedule) {
			return 15;
		}

		if (activeSchedule.roomExceptions?.[roomName] !== undefined) {
			return activeSchedule.roomExceptions[roomName];
		}

		return activeSchedule.targetTemperature;
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

	/**
	 * Start PID measurement for a room
	 */
	public async startPIDMeasurement(
		roomName: string,
		targetTemperature: number
	): Promise<{ success: boolean; error?: string }> {
		if (!this._pidManager) {
			return { success: false, error: 'PID manager not initialized' };
		}
		const result = await this._pidManager.startMeasurement(roomName, targetTemperature);
		if (result.success) {
			this.addHistoryEntry(
				'PID Measurement',
				`Started measurement for ${roomName} to ${targetTemperature}°C`
			);
		}
		return result;
	}

	/**
	 * Stop PID measurement for a room
	 */
	public async stopPIDMeasurement(roomName: string): Promise<{ success: boolean }> {
		if (!this._pidManager) {
			return { success: false };
		}
		const result = await this._pidManager.stopMeasurement(roomName);
		if (result.success) {
			this.addHistoryEntry('PID Measurement', `Stopped measurement for ${roomName}`);
		}
		return result;
	}

	/**
	 * Get PID measurement status for a room
	 */
	public getPIDMeasurementStatus(roomName: string): MeasurementSession | null {
		if (!this._pidManager) {
			return null;
		}
		return this._pidManager.getMeasurementStatus(roomName);
	}

	/**
	 * Check if PID measurement is active for any room
	 */
	public isPIDMeasurementActive(): boolean {
		if (!this._pidManager) {
			return false;
		}
		return this._pidManager.hasActiveMeasurement();
	}

	/**
	 * Check if PID measurement is active for a specific room
	 */
	public isPIDMeasurementActiveForRoom(roomName: string): boolean {
		if (!this._pidManager) {
			return false;
		}
		return this._pidManager.isMeasurementActive(roomName);
	}

	/**
	 * Get PID parameters for a room
	 */
	public getPIDParameters(roomName: string): PIDParameters | null {
		if (!this._pidManager) {
			return null;
		}
		return this._pidManager.getPIDParameters(roomName);
	}

	/**
	 * Clear PID parameters for a room
	 */
	public clearPIDParameters(roomName: string): void {
		if (!this._pidManager) {
			return;
		}
		this._pidManager.clearPIDParameters(roomName);
		this.addHistoryEntry('PID Parameters', `Cleared PID parameters for ${roomName}`);
	}

	/**
	 * Calculate early stop temperature for a room using PID parameters
	 */
	public calculateEarlyStopTemperature(
		roomName: string,
		currentTemp: number,
		targetTemp: number
	): number | null {
		if (!this._pidManager) {
			return null;
		}
		return this._pidManager.calculateEarlyStopTemperature(roomName, currentTemp, targetTemp);
	}
})();
