import { DeviceRelativeHumidityMeasurementCluster } from './cluster';
import type { Device as DeviceInterface } from './device';
import type { SQL } from 'bun';

export class HumidityTracker {
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

			// Find humidity measurement cluster
			const humidityClusters = device.getAllClustersByType(
				DeviceRelativeHumidityMeasurementCluster
			);
			if (!humidityClusters.length) {
				continue;
			}

			// Store device for interval logging
			this._devices.set(deviceId, device);

			for (const humidityCluster of humidityClusters) {
				let lastHumidity: number | undefined = undefined;

				// Subscribe to humidity changes
				const unsubscribe = humidityCluster.relativeHumidity.subscribe(
					(humidity, isInitial) => {
						if (humidity === undefined) {
							return;
						}
						// Log all humidity readings, including initial
						if (!isInitial || lastHumidity === undefined) {
							// Only log if humidity changed by at least 1%
							if (
								lastHumidity === undefined ||
								Math.abs(humidity - lastHumidity) >= 0.01
							) {
								lastHumidity = humidity;
								void this.logEvent(deviceId, humidity);
							}
						} else {
							lastHumidity = humidity;
						}
					}
				);

				this._subscriptions.set(deviceId, unsubscribe);
			}
		}
	}

	private async _logAllCurrentValues(): Promise<void> {
		for (const [deviceId, device] of this._devices) {
			const humidityClusters = device.getAllClustersByType(
				DeviceRelativeHumidityMeasurementCluster
			);
			for (const humidityCluster of humidityClusters) {
				const humidity = await humidityCluster.relativeHumidity.get();
				if (humidity !== undefined) {
					void this.logEvent(deviceId, humidity);
				}
			}
		}
	}

	private async logEvent(deviceId: string, humidity: number): Promise<void> {
		try {
			await this._sqlDB`
				INSERT INTO humidity_events (device_id, humidity, timestamp)
				VALUES (${deviceId}, ${humidity}, ${Date.now()})
			`;
		} catch (error) {
			console.error(`Failed to log humidity event for ${deviceId}:`, error);
		}
	}

	public async getHistory(
		deviceId: string,
		timeframeMs?: number
	): Promise<Array<{ humidity: number; timestamp: number }>> {
		try {
			const cutoffTime = timeframeMs ? Date.now() - timeframeMs : 0;
			const results = await this._sqlDB<Array<{ humidity: number; timestamp: number }>>`
				SELECT humidity, timestamp 
				FROM humidity_events 
				WHERE device_id = ${deviceId}
				AND timestamp >= ${cutoffTime}
				ORDER BY timestamp DESC
			`;
			return results;
		} catch (error) {
			console.error(`Failed to fetch humidity history for ${deviceId}:`, error);
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
