import { logTag } from '../../lib/logging/logger';
import { Temperature } from './index';
import type { AllModules } from '..';

/**
 * Central Thermostat Coordinator
 *
 * Monitors all room thermostats and ensures the central thermostat
 * is heating when any room thermostat demands heat.
 *
 * This creates a "lead-follow" system where:
 * - Room TRVs (thermostatic radiator valves) call for heat
 * - Central thermostat responds by heating the water/boiler
 */
export class ThermostatCoordinator {
	private readonly _modules: AllModules;
	private _intervalId: ReturnType<typeof setInterval> | null = null;
	private _lastCentralHeatingState: boolean | null = null;

	public constructor(modules: AllModules) {
		this._modules = modules;
	}

	/**
	 * Start the coordinator - checks every 30 seconds
	 */
	public start(): void {
		if (this._intervalId) {
			return; // Already running
		}

		logTag('temperature', 'blue', 'Starting thermostat coordinator');

		// Check immediately on start
		void this._checkAndCoordinate();

		// Then check every 30 seconds
		this._intervalId = setInterval(() => {
			void this._checkAndCoordinate();
		}, 30000);
	}

	/**
	 * Stop the coordinator
	 */
	public stop(): void {
		if (this._intervalId) {
			clearInterval(this._intervalId);
			this._intervalId = null;
			logTag('temperature', 'blue', 'Stopped thermostat coordinator');
		}
	}

	/**
	 * Check room thermostats and coordinate with central thermostat
	 */
	private async _checkAndCoordinate(): Promise<void> {
		try {
			const status = await Temperature.getHouseHeatingStatus(this._modules);

			// If there's no central thermostat configured, nothing to coordinate
			if (!status.centralThermostat) {
				return;
			}

			const anyRoomHeating = status.heatingRooms.length > 0;

			// Only log and act when the state changes
			if (this._lastCentralHeatingState !== anyRoomHeating) {
				if (anyRoomHeating) {
					logTag(
						'temperature',
						'yellow',
						`Rooms heating: ${status.heatingRooms.join(', ')} - Ensuring central thermostat is heating`
					);

					// If any room is heating, ensure central thermostat is set to heat
					// We set a high target temperature to ensure it heats
					// The actual room TRVs will control the individual room temperatures
					if (!status.centralThermostat.isHeating) {
						// Find the maximum target temperature among heating rooms
						const roomThermostats = await Temperature.getRoomThermostats(this._modules);
						let maxTargetTemp = 21; // Default fallback

						for (const roomName of status.heatingRooms) {
							const roomStatus = roomThermostats.get(roomName);
							if (roomStatus && roomStatus.targetTemperature > maxTargetTemp) {
								maxTargetTemp = roomStatus.targetTemperature;
							}
						}

						// Set central thermostat slightly above the max room target
						// This ensures the boiler provides heat
						await Temperature.setCentralThermostatTarget(
							this._modules,
							Math.min(maxTargetTemp + 2, 30)
						);
					}
				} else {
					logTag('temperature', 'cyan', 'No rooms heating - Central thermostat can idle');

					// When no rooms are heating, we could lower the central thermostat
					// But we'll leave it in manual mode and let the user control it
					// or let the schedule take over
				}

				this._lastCentralHeatingState = anyRoomHeating;
			}
		} catch (error) {
			logTag('temperature', 'red', 'Coordinator check failed:', error);
		}
	}

	/**
	 * Force a coordination check (e.g., after manual changes)
	 */
	public async forceCheck(): Promise<void> {
		await this._checkAndCoordinate();
	}
}

let coordinatorInstance: ThermostatCoordinator | null = null;

/**
 * Initialize the thermostat coordinator
 * Should be called once during module initialization
 */
export function initCoordinator(modules: AllModules): ThermostatCoordinator {
	if (coordinatorInstance) {
		coordinatorInstance.stop();
	}
	coordinatorInstance = new ThermostatCoordinator(modules);
	coordinatorInstance.start();
	return coordinatorInstance;
}

/**
 * Get the current coordinator instance
 */
export function getCoordinator(): ThermostatCoordinator | null {
	return coordinatorInstance;
}
