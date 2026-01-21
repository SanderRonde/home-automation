import { SceneTriggerType } from '../../../../types/scene';
import { DeviceOccupancySensingCluster } from './cluster';
import type { Device as DeviceInterface } from './device';
import type { SceneAPI } from './scene-api';
import type { SQL } from 'bun';

export class OccupancyTracker {
	private _subscriptions = new Map<string, () => void>();

	public constructor(
		private readonly _sqlDB: SQL,
		private readonly _sceneAPI: SceneAPI
	) {
		// Ensure the occupancy_events table exists
		void this._migrateTable();
	}

	private async _migrateTable(): Promise<void> {
		try {
			// Check if table exists
			const tableExists = await this._sqlDB<{ name: string }[]>`
				SELECT name FROM sqlite_master WHERE type='table' AND name='occupancy_events'
			`;
			if (!tableExists.length) {
				// Create table
				await this._sqlDB`
					CREATE TABLE occupancy_events (
						id INTEGER PRIMARY KEY AUTOINCREMENT,
						device_id TEXT NOT NULL,
						occupied INTEGER NOT NULL,
						timestamp INTEGER NOT NULL
					)
				`;
				await this._sqlDB`
					CREATE INDEX idx_occupancy_device_time ON occupancy_events(device_id, timestamp DESC)
				`;
			}
		} catch (error) {
			console.error('Failed to migrate occupancy_events table:', error);
		}
	}

	public trackDevices(devices: DeviceInterface[]): void {
		for (const device of devices) {
			const deviceId = device.getUniqueId();

			// Skip if already tracking
			if (this._subscriptions.has(deviceId)) {
				continue;
			}

			// Find occupancy sensing cluster
			const occupancyClusters = device.getAllClustersByType(DeviceOccupancySensingCluster);
			if (!occupancyClusters.length) {
				continue;
			}

			for (const occupancyCluster of occupancyClusters) {
				let lastState: boolean | undefined = undefined;

				// Subscribe to occupancy changes
				const unsubscribe = occupancyCluster.onOccupied.listen(({ occupied }) => {
					if (lastState !== occupied) {
						lastState = occupied;
						void this.logEvent(deviceId, occupied);
						void this._sceneAPI.onTrigger({
							type: SceneTriggerType.OCCUPANCY,
							deviceId,
							occupied,
						});
					}
				});

				this._subscriptions.set(deviceId, unsubscribe);
			}
		}
	}

	private async logEvent(deviceId: string, occupied: boolean): Promise<void> {
		try {
			await this._sqlDB`
				INSERT INTO occupancy_events (device_id, occupied, timestamp)
				VALUES (${deviceId}, ${occupied ? 1 : 0}, ${Date.now()})
			`;
		} catch (error) {
			console.error(`Failed to log occupancy event for ${deviceId}:`, error);
		}
	}

	public async getHistory(
		deviceId: string,
		limit = 100
	): Promise<Array<{ occupied: boolean; timestamp: number }>> {
		try {
			const results = await this._sqlDB<Array<{ occupied: number; timestamp: number }>>`
				SELECT occupied, timestamp 
				FROM occupancy_events 
				WHERE device_id = ${deviceId}
				ORDER BY timestamp DESC
				LIMIT ${limit}
			`;
			return results.map((r) => ({
				occupied: r.occupied === 1,
				timestamp: r.timestamp,
			}));
		} catch (error) {
			console.error(`Failed to fetch occupancy history for ${deviceId}:`, error);
			return [];
		}
	}

	public async getLastTriggered(deviceId: string): Promise<{ timestamp: number } | null> {
		try {
			const results = await this._sqlDB<
				{
					occupied: number;
					timestamp: number;
				}[]
			>`
				SELECT occupied, timestamp 
				FROM occupancy_events 
				WHERE device_id = ${deviceId}
				AND occupied = 1
				ORDER BY timestamp DESC
				LIMIT 1
			`;
			if (results.length > 0) {
				return {
					timestamp: results[0].timestamp,
				};
			}
		} catch (error) {
			console.error(`Failed to fetch last occupancy event for ${deviceId}:`, error);
		}
		return null;
	}
}
