import { Temperature, CENTRAL_THERMOSTAT_HEATING_OFFSET } from './index';
import type { PIDParameters, MeasurementSession } from './types';
import { DeviceThermostatCluster } from '../device/cluster';
import { logTag } from '../../lib/logging/logger';
import type { AllModules } from '..';

/**
 * PID Measurement Manager
 * Handles measurement sessions for determining room heating characteristics
 */
export class PIDMeasurementManager {
	private readonly _modules: AllModules;
	private readonly _db: (typeof Temperature)['_db'];
	private _activeMeasurements: Map<string, MeasurementSession> = new Map();
	private _measurementIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();

	public constructor(modules: AllModules, db: (typeof Temperature)['_db']) {
		this._modules = modules;
		this._db = db;
	}

	/**
	 * Start a PID measurement session for a room
	 */
	public async startMeasurement(
		roomName: string,
		targetTemperature: number
	): Promise<{ success: boolean; error?: string }> {
		// Check if measurement already active
		if (this._activeMeasurements.has(roomName)) {
			return { success: false, error: 'Measurement already in progress' };
		}

		// Get current room temperature
		const deviceApi = await this._modules.device.api.value;
		const storedDevices = deviceApi.getStoredDevices();
		const allDevices = deviceApi.devices.current();
		const roomStatus = await Temperature.getRoomStatus(allDevices, storedDevices, roomName);
		if (roomStatus.currentTemperature <= 0) {
			return {
				success: false,
				error: 'No temperature sensor available for this room',
			};
		}

		const startTemperature = roomStatus.currentTemperature;

		// Check if room has TRV
		const centralThermostatId = Temperature.getThermostat();

		let hasTRV = false;
		for (const deviceId in allDevices) {
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

		if (!hasTRV) {
			return { success: false, error: 'Room has no TRV to control' };
		}

		// Validate target temperature
		if (targetTemperature <= startTemperature) {
			return {
				success: false,
				error: 'Target temperature must be higher than current temperature',
			};
		}

		// Create measurement session
		const session: MeasurementSession = {
			startTime: Date.now(),
			startTemperature,
			targetTemperature,
			roomName,
			status: 'measuring',
			lastTemperature: startTemperature,
			lastUpdateTime: Date.now(),
		};

		this._activeMeasurements.set(roomName, session);

		// Override temperature controller: stop all other rooms
		await this._overrideOtherRooms(roomName);

		// Set target room to full heat
		await Temperature.setRoomTRVTargets(this._modules, roomName, true);

		// Ensure central thermostat is on - use dynamic temperature
		const currentStatus = await Temperature.getCentralThermostatStatus(
			deviceApi.devices.current() ?? {}
		);
		const currentTemp = currentStatus?.currentTemperature ?? 20;
		const targetTemp = currentTemp + CENTRAL_THERMOSTAT_HEATING_OFFSET;
		await Temperature.setThermostatHardwareTarget(this._modules, targetTemp);

		logTag(
			'temperature',
			'cyan',
			`Started PID measurement for ${roomName}: ${startTemperature.toFixed(1)}°C → ${targetTemperature}°C`
		);

		// Start monitoring interval (every 30 seconds)
		const intervalId = setInterval(() => {
			void this._checkMeasurementProgress(roomName);
		}, 30000);

		this._measurementIntervals.set(roomName, intervalId);

		// Do initial check
		void this._checkMeasurementProgress(roomName);

		return { success: true };
	}

	/**
	 * Stop/cancel a measurement session
	 */
	public async stopMeasurement(roomName: string): Promise<{ success: boolean }> {
		const session = this._activeMeasurements.get(roomName);
		if (!session) {
			return { success: false };
		}

		// Cancel interval
		const intervalId = this._measurementIntervals.get(roomName);
		if (intervalId) {
			clearInterval(intervalId);
			this._measurementIntervals.delete(roomName);
		}

		// Mark as cancelled
		session.status = 'cancelled';
		this._activeMeasurements.delete(roomName);

		// Restore normal control
		await this._restoreNormalControl();

		logTag('temperature', 'yellow', `Cancelled PID measurement for ${roomName}`);

		return { success: true };
	}

	/**
	 * Get status of active measurement
	 */
	public getMeasurementStatus(roomName: string): MeasurementSession | null {
		return this._activeMeasurements.get(roomName) ?? null;
	}

	/**
	 * Check if any measurement is active
	 */
	public hasActiveMeasurement(): boolean {
		return this._activeMeasurements.size > 0;
	}

	/**
	 * Check if specific room has active measurement
	 */
	public isMeasurementActive(roomName: string): boolean {
		return this._activeMeasurements.has(roomName);
	}

	/**
	 * Get stored PID parameters for a room
	 */
	public getPIDParameters(roomName: string): PIDParameters | null {
		if (!this._db) {
			return null;
		}
		const data = this._db.current() as { roomPIDParameters?: Record<string, PIDParameters> };
		return data.roomPIDParameters?.[roomName] ?? null;
	}

	/**
	 * Store PID parameters for a room
	 */
	public setPIDParameters(roomName: string, parameters: PIDParameters): void {
		if (!this._db) {
			return;
		}
		this._db.update((old) => {
			const data = old as { roomPIDParameters?: Record<string, PIDParameters> };
			const roomPIDParameters = { ...(data.roomPIDParameters || {}) };
			roomPIDParameters[roomName] = parameters;
			return {
				...data,
				roomPIDParameters,
			};
		});
	}

	/**
	 * Clear PID parameters for a room
	 */
	public clearPIDParameters(roomName: string): void {
		if (!this._db) {
			return;
		}
		this._db.update((old) => {
			const data = old as { roomPIDParameters?: Record<string, PIDParameters> };
			const roomPIDParameters = { ...(data.roomPIDParameters || {}) };
			delete roomPIDParameters[roomName];
			return {
				...data,
				roomPIDParameters,
			};
		});
	}

	/**
	 * Calculate early stop temperature based on PID parameters
	 * Returns the temperature at which heating should stop to account for residual heat
	 */
	public calculateEarlyStopTemperature(
		roomName: string,
		currentTemp: number,
		targetTemp: number
	): number | null {
		const pidParams = this.getPIDParameters(roomName);
		if (!pidParams) {
			return null; // No PID data, use dumb mode
		}

		// Calculate how much the temperature will continue to rise after stopping
		// overshootTimeConstant is in minutes, heatingRate is °C/min
		// So residual heat = heatingRate * overshootTimeConstant
		// But we need to account for the fact that heating rate decreases as we approach target
		// Use a simple linear approximation: residual = heatingRate * overshootTimeConstant * (1 - progress)
		const tempDiff = targetTemp - currentTemp;
		const totalDiff = targetTemp - (pidParams.startTemperature ?? currentTemp);
		const progress = totalDiff > 0 ? Math.max(0, Math.min(1, tempDiff / totalDiff)) : 0;

		// Residual heat decreases as we get closer to target
		const residualHeat =
			pidParams.heatingRate * pidParams.overshootTimeConstant * (1 - progress * 0.5);

		// Early stop when we're close enough that residual heat will carry us to target
		const earlyStopTemp = targetTemp - residualHeat;

		return earlyStopTemp;
	}

	/**
	 * Check measurement progress and complete if target reached
	 */
	private async _checkMeasurementProgress(roomName: string): Promise<void> {
		const session = this._activeMeasurements.get(roomName);
		if (session?.status !== 'measuring') {
			return;
		}

		// Get current room temperature
		const deviceApi = await this._modules.device.api.value;
		const storedDevices = deviceApi.getStoredDevices();
		const allDevices = deviceApi.devices.current();
		const roomStatus = await Temperature.getRoomStatus(allDevices, storedDevices, roomName);
		const currentTemp = roomStatus.currentTemperature;

		if (currentTemp <= 0) {
			// No valid temperature reading
			return;
		}

		session.lastTemperature = currentTemp;
		session.lastUpdateTime = Date.now();

		// Calculate heating rate
		const elapsedMinutes = (Date.now() - session.startTime) / 60000;
		const tempRise = currentTemp - session.startTemperature;
		session.heatingRate = tempRise / elapsedMinutes;

		// Check if target reached (within 0.2°C)
		if (currentTemp >= session.targetTemperature - 0.2) {
			await this._completeMeasurement(roomName);
		}
	}

	/**
	 * Complete a measurement and store PID parameters
	 */
	private async _completeMeasurement(roomName: string): Promise<void> {
		const session = this._activeMeasurements.get(roomName);
		if (!session) {
			return;
		}

		// Stop interval
		const intervalId = this._measurementIntervals.get(roomName);
		if (intervalId) {
			clearInterval(intervalId);
			this._measurementIntervals.delete(roomName);
		}

		// Mark as completed
		session.status = 'completed';
		session.completionTime = Date.now();

		// Calculate final parameters
		const elapsedMinutes = (session.completionTime - session.startTime) / 60000;
		const tempRise = session.targetTemperature - session.startTemperature;
		const heatingRate = tempRise / elapsedMinutes;

		// Estimate overshoot time constant (default: 5-10 minutes based on heating rate)
		// Faster heating = more residual heat = longer overshoot
		const overshootTimeConstant = Math.max(5, Math.min(10, heatingRate * 2));

		// Get existing parameters or create new
		const existingParams = this.getPIDParameters(roomName);
		const measurementCount = (existingParams?.measurementCount ?? 0) + 1;

		// Average with existing if available (weighted average: 70% new, 30% old)
		const newParams: PIDParameters = {
			heatingRate: existingParams
				? existingParams.heatingRate * 0.3 + heatingRate * 0.7
				: heatingRate,
			overshootTimeConstant: existingParams
				? existingParams.overshootTimeConstant * 0.3 + overshootTimeConstant * 0.7
				: overshootTimeConstant,
			lastUpdated: Date.now(),
			measurementCount,
			startTemperature: session.startTemperature,
			targetTemperature: session.targetTemperature,
			completionTime: elapsedMinutes,
		};

		// Store parameters
		this.setPIDParameters(roomName, newParams);

		// Remove from active measurements
		this._activeMeasurements.delete(roomName);

		// Restore normal control
		await this._restoreNormalControl();

		logTag(
			'temperature',
			'green',
			`Completed PID measurement for ${roomName}: heating rate ${heatingRate.toFixed(2)}°C/min, overshoot ${overshootTimeConstant.toFixed(1)}min`
		);
	}

	/**
	 * Override other rooms: set all other rooms' TRVs to 15°C
	 */
	private async _overrideOtherRooms(measuringRoom: string): Promise<void> {
		const deviceApi = await this._modules.device.api.value;
		const rooms = deviceApi.getRooms(deviceApi.getStoredDevices());
		const roomNames = Object.keys(rooms);

		for (const roomName of roomNames) {
			if (roomName === measuringRoom) {
				continue;
			}
			// Set other rooms to not heating
			await Temperature.setRoomTRVTargets(this._modules, roomName, false);
		}
	}

	/**
	 * Restore normal control (let scheduler handle it)
	 */
	private async _restoreNormalControl(): Promise<void> {
		// The scheduler will take over on next check
		// We just need to clear any overrides
		// The scheduler's _checkSchedule will run and restore normal operation
	}
}
