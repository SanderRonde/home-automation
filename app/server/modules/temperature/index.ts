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

export const Temperature = new (class Temperature extends ModuleMeta {
	public name = 'temperature';
	private _db: ModuleConfig['db'] | null = null;

	public init(config: ModuleConfig) {
		this._db = config.db;

		// Initialize the temperature scheduler
		initScheduler(config.modules);

		return {
			serve: initRouting(config),
		};
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
	 * Set the target temperature on the central thermostat and switch to manual mode
	 */
	public async setCentralThermostatTarget(
		modules: AllModules,
		targetTemperature: number
	): Promise<boolean> {
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
				`Set central thermostat target to ${targetTemperature}°C (manual mode)`
			);
			return true;
		} catch (error) {
			logTag(
				'temperature',
				'red',
				`Failed to set central thermostat target: ${thermostatId}`,
				error
			);
			return false;
		}
	}
})();
