import { DeviceTemperatureMeasurementCluster } from './cluster';
import type { Device as DeviceInterface } from './device';
import type { SQL } from 'bun';

export class TemperatureTracker {
	private _subscriptions = new Map<string, () => void>();
	private readonly _intervalId?: Timer;
	private _devices = new Map<string, DeviceInterface>();

	public constructor(private readonly _sqlDB: SQL) {
		// Start interval logging (once per minute)
		this._intervalId = setInterval(() => {
			void this._logAllCurrentValues();
		}, 60_000); // 60 seconds
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
			await this._sqlDB`
				INSERT INTO temperature_events (device_id, temperature, timestamp)
				VALUES (${deviceId}, ${temperature}, ${Date.now()})
			`;
		} catch (error) {
			console.error(`Failed to log temperature event for ${deviceId}:`, error);
		}
	}

	public async getHistory(
		deviceId: string,
		limit = 100,
		timeframeMs?: number
	): Promise<Array<{ temperature: number; timestamp: number }>> {
		try {
			const cutoffTime = timeframeMs ? Date.now() - timeframeMs : 0;
			const results = await this._sqlDB<Array<{ temperature: number; timestamp: number }>>`
				SELECT temperature, timestamp 
				FROM temperature_events 
				WHERE device_id = ${deviceId}
				AND timestamp >= ${cutoffTime}
				ORDER BY timestamp DESC
				LIMIT ${limit}
			`;
			return results;
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
