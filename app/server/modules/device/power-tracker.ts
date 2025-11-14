import { DeviceElectricalPowerMeasurementCluster } from './cluster';
import type { Device as DeviceInterface } from './device';
import type { SQL } from 'bun';

export class PowerTracker {
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

			// Find power measurement cluster
			const powerClusters = device.getAllClustersByType(
				DeviceElectricalPowerMeasurementCluster
			);
			if (!powerClusters.length) {
				continue;
			}

			// Store device for interval logging
			this._devices.set(deviceId, device);

			for (const powerCluster of powerClusters) {
				let lastPower: number | undefined = undefined;

				// Subscribe to power changes
				const unsubscribe = powerCluster.activePower.subscribe(
					(power, isInitial) => {
						if (power === undefined) {
							return;
						}
						// Log all power readings, including initial
						if (!isInitial || lastPower === undefined) {
							// Only log if power changed by at least 1 watt
							if (
								lastPower === undefined ||
								Math.abs(power - lastPower) >= 1
							) {
								lastPower = power;
								void this.logEvent(deviceId, power);
							}
						} else {
							lastPower = power;
						}
					}
				);

				this._subscriptions.set(deviceId, unsubscribe);
			}
		}
	}

	private async _logAllCurrentValues(): Promise<void> {
		for (const [deviceId, device] of this._devices) {
			const powerClusters = device.getAllClustersByType(
				DeviceElectricalPowerMeasurementCluster
			);
			for (const powerCluster of powerClusters) {
				const power = await powerCluster.activePower.get();
				if (power !== undefined) {
					void this.logEvent(deviceId, power);
				}
			}
		}
	}

	private async logEvent(deviceId: string, activePower: number): Promise<void> {
		try {
			await this._sqlDB`
				INSERT INTO power_events (device_id, active_power, timestamp)
				VALUES (${deviceId}, ${activePower}, ${Date.now()})
			`;
		} catch (error) {
			console.error(`Failed to log power event for ${deviceId}:`, error);
		}
	}

	public async getHistory(
		deviceId: string,
		limit = 1000,
		timeframeMs?: number
	): Promise<Array<{ activePower: number; timestamp: number }>> {
		try {
			const cutoffTime = timeframeMs ? Date.now() - timeframeMs : 0;
			const results = await this._sqlDB<Array<{ active_power: number; timestamp: number }>>`
				SELECT active_power, timestamp 
				FROM power_events 
				WHERE device_id = ${deviceId}
				AND timestamp >= ${cutoffTime}
				ORDER BY timestamp DESC
				LIMIT ${limit}
			`;
			return results.map((r) => ({
				activePower: r.active_power,
				timestamp: r.timestamp,
			}));
		} catch (error) {
			console.error(`Failed to fetch power history for ${deviceId}:`, error);
			return [];
		}
	}

	public async getAllDevicesHistory(
		limit = 1000,
		timeframeMs?: number
	): Promise<Array<{ deviceId: string; activePower: number; timestamp: number }>> {
		try {
			const cutoffTime = timeframeMs ? Date.now() - timeframeMs : 0;
			const results = await this._sqlDB<
				Array<{ device_id: string; active_power: number; timestamp: number }>
			>`
				SELECT device_id, active_power, timestamp 
				FROM power_events 
				WHERE timestamp >= ${cutoffTime}
				ORDER BY timestamp DESC
				LIMIT ${limit}
			`;
			return results.map((r) => ({
				deviceId: r.device_id,
				activePower: r.active_power,
				timestamp: r.timestamp,
			}));
		} catch (error) {
			console.error(`Failed to fetch all devices power history:`, error);
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
