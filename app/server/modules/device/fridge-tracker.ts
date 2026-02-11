import type { Device as DeviceInterface } from './device';
import { DeviceFridgeCluster } from './cluster';
import type { SQL } from 'bun';

export interface FridgeEvent {
	timestamp: number;
	fridgeTempC: number | null;
	freezerTempC: number | null;
	freezerDoorOpen: boolean | null;
	coolerDoorOpen: boolean | null;
}

export class FridgeTracker {
	private _devices = new Map<string, DeviceInterface>();
	private readonly _intervalId?: Timer;

	public constructor(private readonly _sqlDB: SQL) {
		void this._migrateTable();
		this._intervalId = setInterval(() => {
			void this._logAllCurrentValues();
		}, 60_000); // 60 seconds
	}

	private async _migrateTable(): Promise<void> {
		try {
			const tableExists = await this._sqlDB<{ name: string }[]>`
				SELECT name FROM sqlite_master WHERE type='table' AND name='fridge_events'
			`;
			if (!tableExists.length) {
				await this._sqlDB`
					CREATE TABLE fridge_events (
						id INTEGER PRIMARY KEY AUTOINCREMENT,
						device_id TEXT NOT NULL,
						timestamp INTEGER NOT NULL,
						fridge_temp_c REAL,
						freezer_temp_c REAL,
						freezer_door_open INTEGER,
						cooler_door_open INTEGER
					)
				`;
				await this._sqlDB`
					CREATE INDEX idx_fridge_events_device_time ON fridge_events(device_id, timestamp DESC)
				`;
			}
		} catch (error) {
			console.error('Failed to migrate fridge_events table:', error);
		}
	}

	public trackDevices(devices: DeviceInterface[]): void {
		for (const device of devices) {
			const deviceId = device.getUniqueId();
			if (this._devices.has(deviceId)) {
				continue;
			}
			const fridgeClusters = device.getAllClustersByType(DeviceFridgeCluster);
			if (!fridgeClusters.length) {
				continue;
			}
			this._devices.set(deviceId, device);
		}
	}

	private async _logAllCurrentValues(): Promise<void> {
		for (const [deviceId, device] of this._devices) {
			const fridgeClusters = device.getAllClustersByType(DeviceFridgeCluster);
			for (const fridgeCluster of fridgeClusters) {
				const fridgeTempC = fridgeCluster.fridgeTempC.current();
				const freezerTempC = fridgeCluster.freezerTempC.current();
				const freezerDoorOpen = fridgeCluster.freezerDoorOpen.current();
				const coolerDoorOpen = fridgeCluster.coolerDoorOpen.current();
				void this.logEvent(deviceId, {
					fridgeTempC: fridgeTempC ?? null,
					freezerTempC: freezerTempC ?? null,
					freezerDoorOpen: freezerDoorOpen ?? null,
					coolerDoorOpen: coolerDoorOpen ?? null,
				});
			}
		}
	}

	public async logEvent(
		deviceId: string,
		state: {
			fridgeTempC: number | null;
			freezerTempC: number | null;
			freezerDoorOpen: boolean | null;
			coolerDoorOpen: boolean | null;
		}
	): Promise<void> {
		try {
			await this._sqlDB`
				INSERT INTO fridge_events (device_id, timestamp, fridge_temp_c, freezer_temp_c, freezer_door_open, cooler_door_open)
				VALUES (${deviceId}, ${Date.now()}, ${state.fridgeTempC}, ${state.freezerTempC}, ${state.freezerDoorOpen === true ? 1 : state.freezerDoorOpen === false ? 0 : null}, ${state.coolerDoorOpen === true ? 1 : state.coolerDoorOpen === false ? 0 : null})
			`;
		} catch (error) {
			console.error(`Failed to log fridge event for ${deviceId}:`, error);
		}
	}

	public async getHistory(deviceId: string, timeframeMs?: number): Promise<FridgeEvent[]> {
		try {
			const cutoffTime = timeframeMs ? Date.now() - timeframeMs : 0;
			const results = await this._sqlDB<
				Array<{
					timestamp: number;
					fridge_temp_c: number | null;
					freezer_temp_c: number | null;
					freezer_door_open: number | null;
					cooler_door_open: number | null;
				}>
			>`
				SELECT timestamp, fridge_temp_c, freezer_temp_c, freezer_door_open, cooler_door_open
				FROM fridge_events
				WHERE device_id = ${deviceId}
				AND timestamp >= ${cutoffTime}
				ORDER BY timestamp DESC
			`;
			return results.map((row) => ({
				timestamp: row.timestamp,
				fridgeTempC: row.fridge_temp_c,
				freezerTempC: row.freezer_temp_c,
				freezerDoorOpen:
					row.freezer_door_open === null ? null : row.freezer_door_open === 1,
				coolerDoorOpen: row.cooler_door_open === null ? null : row.cooler_door_open === 1,
			}));
		} catch (error) {
			console.error(`Failed to fetch fridge history for ${deviceId}:`, error);
			return [];
		}
	}

	public destroy(): void {
		if (this._intervalId) {
			clearInterval(this._intervalId);
		}
		this._devices.clear();
	}
}
