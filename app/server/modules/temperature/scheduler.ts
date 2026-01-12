import {
	Temperature,
	CENTRAL_THERMOSTAT_HEATING_OFFSET,
	CENTRAL_THERMOSTAT_OFF_OFFSET,
} from './index';
import { ThermostatMode } from '../device/cluster';
import { logTag } from '../../lib/logging/logger';
import type { AllModules } from '..';

/**
 * Temperature Schedule Executor
 * Checks every minute if a schedule boundary has been crossed and applies the new temperature
 */
export class TemperatureScheduler {
	private readonly _modules: AllModules;
	private _intervalId: ReturnType<typeof setInterval> | null = null;
	private _lastCheckMinute: number = -1;

	public constructor(modules: AllModules) {
		this._modules = modules;
	}

	/**
	 * Start the scheduler - checks every minute
	 */
	public start(): void {
		if (this._intervalId) {
			return; // Already running
		}

		logTag('temperature', 'blue', 'Starting temperature scheduler');

		// Check immediately on start
		void this._checkSchedule();

		// Then check every minute
		this._intervalId = setInterval(() => {
			void this._checkSchedule();
		}, 60000);
	}

	/**
	 * Stop the scheduler
	 */
	public stop(): void {
		if (this._intervalId) {
			clearInterval(this._intervalId);
			this._intervalId = null;
			logTag('temperature', 'blue', 'Stopped temperature scheduler');
		}
	}

	/**
	 * Check if we need to apply a new schedule/update thermostat based on room demand
	 */
	private async _checkSchedule(): Promise<void> {
		const now = new Date();
		const currentMinute = now.getHours() * 60 + now.getMinutes();

		// Avoid running multiple times in the same minute
		if (currentMinute === this._lastCheckMinute) {
			return;
		}
		this._lastCheckMinute = currentMinute;

		// Check if PID measurement is active - if so, skip normal control
		// The PID measurement manager handles control during measurement
		if (Temperature.isPIDMeasurementActive()) {
			return;
		}

		// Check heating demand from all rooms
		// Use needsHeating (not isHeating) since isHeating depends on central thermostat status
		const deviceApi = await this._modules.device.api.value;
		const storedDevices = deviceApi.getStoredDevices();
		const allDevices = deviceApi.devices.current();
		const roomStatuses = await Temperature.getAllRoomsStatus(
			allDevices,
			storedDevices,
			deviceApi.getRooms(storedDevices)
		);
		const roomsNeedingHeat = roomStatuses.filter((status) => status.needsHeating);
		const needsHeating = roomsNeedingHeat.length > 0;

		// Get current central thermostat temperature
		const currentStatus = await Temperature.getCentralThermostatStatus(allDevices);
		const currentTemp = currentStatus?.currentTemperature ?? 20; // Fallback to 20°C

		// Calculate dynamic target based on heating demand
		// Heating: current + offset, Off: current - offset
		const targetCentralTemp = needsHeating
			? currentTemp + CENTRAL_THERMOSTAT_HEATING_OFFSET
			: currentTemp - CENTRAL_THERMOSTAT_OFF_OFFSET;

		// Record decision reason
		let decisionReason = '';
		if (needsHeating) {
			const roomNames = roomsNeedingHeat.map((r) => r.name).join(', ');
			decisionReason = `Heating demanded by: ${roomNames}`;
		} else {
			decisionReason = 'No rooms require heating';
		}
		Temperature.setLastDecision(decisionReason);

		// Check if we need to update
		const needsUpdate =
			currentStatus?.targetTemperature !== targetCentralTemp ||
			currentStatus.mode !== ThermostatMode.MANUAL;

		if (needsUpdate) {
			logTag(
				'temperature',
				needsHeating ? 'green' : 'blue',
				`Updating central thermostat: ${decisionReason} -> ${targetCentralTemp}°C`
			);

			await Temperature.setThermostatHardwareTarget(this._modules, targetCentralTemp);
		}

		// Update individual room TRVs - set to 30 if room needs heating, 15 if not
		// This bypasses the TRVs' own control logic which "sucks"
		await Temperature.updateAllRoomTRVs(
			this._modules,
			roomStatuses.map((r) => ({ name: r.name, isHeating: r.needsHeating }))
		);
	}
}

let schedulerInstance: TemperatureScheduler | null = null;

/**
 * Initialize the temperature scheduler
 * Should be called once during module initialization
 */
export function initScheduler(modules: AllModules): TemperatureScheduler {
	if (schedulerInstance) {
		schedulerInstance.stop();
	}
	schedulerInstance = new TemperatureScheduler(modules);
	schedulerInstance.start();
	return schedulerInstance;
}

/**
 * Get the current scheduler instance
 */
export function getScheduler(): TemperatureScheduler | null {
	return schedulerInstance;
}
