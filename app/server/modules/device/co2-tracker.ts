import { DeviceCarbonDioxideConcentrationMeasurementWithNumericAndLevelIndicationCluster } from './cluster';
import type { Device as DeviceInterface } from './device';
import type { SQL } from 'bun';

export class CO2Tracker {
	private _subscriptions = new Map<string, () => void>();
	private readonly _intervalId?: Timer;
	private _devices = new Map<string, DeviceInterface>();

	public constructor(private readonly _sqlDB: SQL) {
		// Create table if needed
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
				SELECT name FROM sqlite_master WHERE type='table' AND name='co2_events'
			`;
			if (!tableExists.length) {
				// Create table
				await this._sqlDB`
					CREATE TABLE co2_events (
						id INTEGER PRIMARY KEY AUTOINCREMENT,
						device_id TEXT NOT NULL,
						concentration REAL NOT NULL,
						level INTEGER NOT NULL,
						timestamp INTEGER NOT NULL
					)
				`;
				await this._sqlDB`
					CREATE INDEX idx_co2_device_time ON co2_events(device_id, timestamp DESC)
				`;
			}
		} catch (error) {
			console.error('Failed to migrate co2_events table:', error);
		}
	}

	public trackDevices(devices: DeviceInterface[]): void {
		for (const device of devices) {
			const deviceId = device.getUniqueId();

			// Skip if already tracking
			if (this._subscriptions.has(deviceId)) {
				continue;
			}

			// Find CO2 measurement cluster
			const co2Clusters = device.getAllClustersByType(
				DeviceCarbonDioxideConcentrationMeasurementWithNumericAndLevelIndicationCluster
			);
			if (!co2Clusters.length) {
				continue;
			}

			// Store device for interval logging
			this._devices.set(deviceId, device);

			for (const co2Cluster of co2Clusters) {
				let lastConcentration: number | undefined = undefined;

				// Subscribe to concentration changes
				const unsubscribe = co2Cluster.concentration.subscribe(
					async (concentration, isInitial) => {
						if (concentration === undefined) {
							return;
						}
						// Log all CO2 readings, including initial
						if (!isInitial || lastConcentration === undefined) {
							// Only log if concentration changed by at least 10 ppm
							if (
								lastConcentration === undefined ||
								Math.abs(concentration - lastConcentration) >= 10
							) {
								lastConcentration = concentration;
								const level = await co2Cluster.level.get();
								void this.logEvent(deviceId, concentration, level);
							}
						} else {
							lastConcentration = concentration;
						}
					}
				);

				this._subscriptions.set(deviceId, unsubscribe);
			}
		}
	}

	private async _logAllCurrentValues(): Promise<void> {
		for (const [deviceId, device] of this._devices) {
			const co2Clusters = device.getAllClustersByType(
				DeviceCarbonDioxideConcentrationMeasurementWithNumericAndLevelIndicationCluster
			);
			for (const co2Cluster of co2Clusters) {
				const concentration = await co2Cluster.concentration.get();
				const level = await co2Cluster.level.get();
				if (concentration !== undefined) {
					void this.logEvent(deviceId, concentration, level);
				}
			}
		}
	}

	private async logEvent(deviceId: string, concentration: number, level: number): Promise<void> {
		try {
			await this._sqlDB`
				INSERT INTO co2_events (device_id, concentration, level, timestamp)
				VALUES (${deviceId}, ${concentration}, ${level}, ${Date.now()})
			`;
		} catch (error) {
			console.error(`Failed to log CO2 event for ${deviceId}:`, error);
		}
	}

	public async getHistory(
		deviceId: string,
		timeframeMs?: number
	): Promise<
		Array<{
			concentration: number;
			level: number;
			timestamp: number;
		}>
	> {
		try {
			const cutoffTime = timeframeMs ? Date.now() - timeframeMs : 0;
			const results = await this._sqlDB<
				Array<{
					concentration: number;
					level: number;
					timestamp: number;
				}>
			>`
				SELECT concentration, level, timestamp
				FROM co2_events 
				WHERE device_id = ${deviceId}
				AND timestamp >= ${cutoffTime}
				ORDER BY timestamp DESC
			`;
			return results.map((row) => ({
				concentration: row.concentration,
				level: row.level,
				timestamp: row.timestamp,
			}));
		} catch (error) {
			console.error(`Failed to fetch CO2 history for ${deviceId}:`, error);
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
