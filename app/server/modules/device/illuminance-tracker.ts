import { DeviceIlluminanceMeasurementCluster } from './cluster';
import type { Device as DeviceInterface } from './device';
import type { SQL } from 'bun';

export class IlluminanceTracker {
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

			// Find illuminance measurement cluster
			const illuminanceClusters = device.getAllClustersByType(
				DeviceIlluminanceMeasurementCluster
			);
			if (!illuminanceClusters.length) {
				continue;
			}

			// Store device for interval logging
			this._devices.set(deviceId, device);

			for (const illuminanceCluster of illuminanceClusters) {
				let lastIlluminance: number | undefined = undefined;

				// Subscribe to illuminance changes
				const unsubscribe = illuminanceCluster.illuminance.subscribe(
					(illuminance, isInitial) => {
						if (illuminance === undefined) {
							return;
						}
						// Log all illuminance readings, including initial
						if (!isInitial || lastIlluminance === undefined) {
							// Only log if illuminance changed by at least 5 lux or 10%
							const threshold =
								lastIlluminance === undefined
									? 0
									: Math.max(5, lastIlluminance * 0.1);
							if (
								lastIlluminance === undefined ||
								Math.abs(illuminance - lastIlluminance) >= threshold
							) {
								lastIlluminance = illuminance;
								void this.logEvent(deviceId, illuminance);
							}
						} else {
							lastIlluminance = illuminance;
						}
					}
				);

				this._subscriptions.set(deviceId, unsubscribe);
			}
		}
	}

	private async _logAllCurrentValues(): Promise<void> {
		for (const [deviceId, device] of this._devices) {
			const illuminanceClusters = device.getAllClustersByType(
				DeviceIlluminanceMeasurementCluster
			);
			for (const illuminanceCluster of illuminanceClusters) {
				const illuminance = await illuminanceCluster.illuminance.get();
				if (illuminance !== undefined) {
					void this.logEvent(deviceId, illuminance);
				}
			}
		}
	}

	private async logEvent(deviceId: string, illuminance: number): Promise<void> {
		try {
			await this._sqlDB`
				INSERT INTO illuminance_events (device_id, illuminance, timestamp)
				VALUES (${deviceId}, ${illuminance}, ${Date.now()})
			`;
		} catch (error) {
			console.error(`Failed to log illuminance event for ${deviceId}:`, error);
		}
	}

	public async getHistory(
		deviceId: string,
		timeframeMs?: number
	): Promise<Array<{ illuminance: number; timestamp: number }>> {
		try {
			const cutoffTime = timeframeMs ? Date.now() - timeframeMs : 0;
			const results = await this._sqlDB<Array<{ illuminance: number; timestamp: number }>>`
				SELECT illuminance, timestamp 
				FROM illuminance_events 
				WHERE device_id = ${deviceId}
				AND timestamp >= ${cutoffTime}
				ORDER BY timestamp DESC
			`;
			return results;
		} catch (error) {
			console.error(`Failed to fetch illuminance history for ${deviceId}:`, error);
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
