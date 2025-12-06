import {
	DeviceTemperatureMeasurementCluster,
	DeviceThermostatCluster,
	ThermostatMode,
} from '../device/cluster';
import type { ModuleConfig, AllModules } from '..';
import { logTag } from '../../lib/logging/logger';
import { getController } from './temp-controller';
import { initRouting } from './routing';
import { ModuleMeta } from '../meta';

type TemperatureSensorConfig = string | { type: 'device'; deviceId: string };

interface TemperatureDB {
	insideTemperatureSensors?: TemperatureSensorConfig[];
	thermostat?: string;
}

export const Temperature = new (class Temperature extends ModuleMeta {
	public name = 'temperature';
	private _db: ModuleConfig['db'] | null = null;

	public init(config: ModuleConfig) {
		this._db = config.db;
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
