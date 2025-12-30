import { DeviceTemperatureMeasurementCluster } from './cluster';
import type { Device as DeviceInterface } from './device';
import type { AllModules } from '..';
import type { SQL } from 'bun';

export class TemperatureTracker {
	private _subscriptions = new Map<string, () => void>();
	private readonly _intervalId?: Timer;
	private _devices = new Map<string, DeviceInterface>();
	private _modules: AllModules | null = null;

	public constructor(private readonly _sqlDB: SQL) {
		// Migrate table schema if needed
		void this._migrateTable();
		// Start interval logging (once per minute)
		this._intervalId = setInterval(() => {
			void this._logAllCurrentValues();
		}, 60_000); // 60 seconds
	}

	private async _migrateTable(): Promise<void> {
		try {
			// Check if table exists
			const tableExists = await this._sqlDB<{ name: string }[]>`
				SELECT name FROM sqlite_master WHERE type='table' AND name='temperature_events'
			`;
			if (!tableExists.length) {
				// Create table with new columns
				await this._sqlDB`
					CREATE TABLE temperature_events (
						id INTEGER PRIMARY KEY AUTOINCREMENT,
						device_id TEXT NOT NULL,
						temperature REAL NOT NULL,
						timestamp INTEGER NOT NULL,
						target_temperature REAL,
						is_heating INTEGER
					)
				`;
				await this._sqlDB`
					CREATE INDEX idx_temperature_device_time ON temperature_events(device_id, timestamp DESC)
				`;
			} else {
				// Try to add new columns if they don't exist
				try {
					await this._sqlDB`
						ALTER TABLE temperature_events ADD COLUMN target_temperature REAL
					`;
				} catch {
					// Column already exists, that's fine
				}
				try {
					await this._sqlDB`
						ALTER TABLE temperature_events ADD COLUMN is_heating INTEGER
					`;
				} catch {
					// Column already exists, that's fine
				}
			}
		} catch (error) {
			console.error('Failed to migrate temperature_events table:', error);
		}
	}

	public setModules(modules: AllModules): void {
		this._modules = modules;
	}

	public trackDevices(devices: DeviceInterface[]): void {
		for (const device of devices) {
			const deviceId = device.getUniqueId();

			// Skip if already tracking
			if (this._subscriptions.has(deviceId)) {
				continue;
			}

			// Find temperature measurement cluster
			const temperatureClusters = device.getAllClustersByType(
				DeviceTemperatureMeasurementCluster
			);
			if (!temperatureClusters.length) {
				continue;
			}

			// Store device for interval logging
			this._devices.set(deviceId, device);

			for (const temperatureCluster of temperatureClusters) {
				let lastTemperature: number | undefined = undefined;

				// Subscribe to temperature changes
				const unsubscribe = temperatureCluster.temperature.subscribe(
					(temperature, isInitial) => {
						if (temperature === undefined) {
							return;
						}
						// Log all temperature readings, including initial
						if (!isInitial || lastTemperature === undefined) {
							// Only log if temperature changed by at least 0.1 degrees
							if (
								lastTemperature === undefined ||
								Math.abs(temperature - lastTemperature) >= 0.1
							) {
								lastTemperature = temperature;
								void this.logEvent(deviceId, temperature);
							}
						} else {
							lastTemperature = temperature;
						}
					}
				);

				this._subscriptions.set(deviceId, unsubscribe);
			}
		}
	}

	private async _logAllCurrentValues(): Promise<void> {
		for (const [deviceId, device] of this._devices) {
			const temperatureClusters = device.getAllClustersByType(
				DeviceTemperatureMeasurementCluster
			);
			for (const temperatureCluster of temperatureClusters) {
				const temperature = await temperatureCluster.temperature.get();
				if (temperature !== undefined) {
					void this.logEvent(deviceId, temperature);
				}
			}
		}
	}

	private async logEvent(deviceId: string, temperature: number): Promise<void> {
		try {
			let targetTemperature: number | null = null;
			let isHeating: boolean | null = null;

			// Get room and calculate target/heating state if modules are available
			if (this._modules) {
				try {
					const deviceApi = await this._modules.device.api.value;
					const storedDevices = deviceApi.getStoredDevices();
					const roomName = storedDevices[deviceId]?.room;

					if (roomName) {
						// Import Temperature module dynamically to avoid circular dependency
						const { Temperature } = await import('../temperature/index.js');
						targetTemperature = Temperature.getRoomTarget(roomName);

						// Determine if heating is active (temperature < target - 0.5°C hysteresis)
						if (targetTemperature !== null) {
							isHeating = temperature < targetTemperature - 0.5;
						}
					}
				} catch (err) {
					// If we can't get room status, that's okay - just log without target/heating
					console.error(
						`Failed to get room status for temperature event ${deviceId}:`,
						err
					);
				}
			}

			// Try to insert with new columns, fall back to old schema if columns don't exist
			try {
				await this._sqlDB`
					INSERT INTO temperature_events (device_id, temperature, timestamp, target_temperature, is_heating)
					VALUES (${deviceId}, ${temperature}, ${Date.now()}, ${targetTemperature}, ${isHeating})
				`;
			} catch (error) {
				// If columns don't exist, try without them (for backward compatibility)
				try {
					await this._sqlDB`
						INSERT INTO temperature_events (device_id, temperature, timestamp)
						VALUES (${deviceId}, ${temperature}, ${Date.now()})
					`;
				} catch (fallbackError) {
					console.error(
						`Failed to log temperature event for ${deviceId}:`,
						fallbackError
					);
				}
			}
		} catch (error) {
			console.error(`Failed to log temperature event for ${deviceId}:`, error);
		}
	}

	public async getHistory(
		deviceId: string,
		limit = 100,
		timeframeMs?: number
	): Promise<
		Array<{
			temperature: number;
			timestamp: number;
			targetTemperature?: number | null;
			isHeating?: boolean | null;
		}>
	> {
		try {
			const cutoffTime = timeframeMs ? Date.now() - timeframeMs : 0;
			// Try to get with new columns, fall back to old schema
			try {
				const results = await this._sqlDB<
					Array<{
						temperature: number;
						timestamp: number;
						target_temperature: number | null;
						is_heating: boolean | null;
					}>
				>`
					SELECT temperature, timestamp, target_temperature, is_heating
					FROM temperature_events 
					WHERE device_id = ${deviceId}
					AND timestamp >= ${cutoffTime}
					ORDER BY timestamp DESC
					LIMIT ${limit}
				`;
				return results.map((row) => ({
					temperature: row.temperature,
					timestamp: row.timestamp,
					targetTemperature: row.target_temperature,
					isHeating: row.is_heating,
				}));
			} catch {
				// Fall back to old schema if columns don't exist
				const results = await this._sqlDB<
					Array<{ temperature: number; timestamp: number }>
				>`
					SELECT temperature, timestamp 
					FROM temperature_events 
					WHERE device_id = ${deviceId}
					AND timestamp >= ${cutoffTime}
					ORDER BY timestamp DESC
					LIMIT ${limit}
				`;
				return results.map((row) => ({
					temperature: row.temperature,
					timestamp: row.timestamp,
					targetTemperature: null,
					isHeating: null,
				}));
			}
		} catch (error) {
			console.error(`Failed to fetch temperature history for ${deviceId}:`, error);
			return [];
		}
	}

	public destroy(): void {
		if (this._intervalId) {
			clearInterval(this._intervalId);
		}
		for (const unsubscribe of this._subscriptions.values()) {
			unsubscribe();
		}
		this._subscriptions.clear();
		this._devices.clear();
	}
}
