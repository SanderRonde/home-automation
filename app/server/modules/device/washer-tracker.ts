import { DeviceWasherCluster } from './cluster';
import type { Device as DeviceInterface } from './device';
import type { SQL } from 'bun';

export interface WasherEvent {
	timestamp: number;
	machineState: string | null;
	done: boolean | null;
	progressPercent: number | null;
	phase: string | null;
	remainingTimeMinutes: number | null;
}

export class WasherTracker {
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
				SELECT name FROM sqlite_master WHERE type='table' AND name='washer_events'
			`;
			if (!tableExists.length) {
				await this._sqlDB`
					CREATE TABLE washer_events (
						id INTEGER PRIMARY KEY AUTOINCREMENT,
						device_id TEXT NOT NULL,
						timestamp INTEGER NOT NULL,
						machine_state TEXT,
						done INTEGER,
						progress_percent REAL,
						phase TEXT,
						remaining_time_minutes INTEGER
					)
				`;
				await this._sqlDB`
					CREATE INDEX idx_washer_events_device_time ON washer_events(device_id, timestamp DESC)
				`;
			}
		} catch (error) {
			console.error('Failed to migrate washer_events table:', error);
		}
	}

	public trackDevices(devices: DeviceInterface[]): void {
		for (const device of devices) {
			const deviceId = device.getUniqueId();
			if (this._devices.has(deviceId)) {
				continue;
			}
			const washerClusters = device.getAllClustersByType(DeviceWasherCluster);
			if (!washerClusters.length) {
				continue;
			}
			this._devices.set(deviceId, device);
		}
	}

	private async _logAllCurrentValues(): Promise<void> {
		for (const [deviceId, device] of this._devices) {
			const washerClusters = device.getAllClustersByType(DeviceWasherCluster);
			for (const washerCluster of washerClusters) {
				const machineState = washerCluster.machineState.current();
				const done = washerCluster.done.current();
				const progressPercent = washerCluster.progressPercent.current();
				const phase = washerCluster.phase.current();
				const remainingTimeMinutes = washerCluster.remainingTimeMinutes.current();
				void this.logEvent(deviceId, {
					machineState: machineState ?? null,
					done: done ?? null,
					progressPercent: progressPercent ?? null,
					phase: phase ?? null,
					remainingTimeMinutes: remainingTimeMinutes ?? null,
				});
			}
		}
	}

	public async logEvent(
		deviceId: string,
		state: {
			machineState: string | null;
			done: boolean | null;
			progressPercent: number | null;
			phase: string | null;
			remainingTimeMinutes: number | null;
		}
	): Promise<void> {
		try {
			await this._sqlDB`
				INSERT INTO washer_events (device_id, timestamp, machine_state, done, progress_percent, phase, remaining_time_minutes)
				VALUES (${deviceId}, ${Date.now()}, ${state.machineState}, ${state.done === true ? 1 : state.done === false ? 0 : null}, ${state.progressPercent}, ${state.phase}, ${state.remainingTimeMinutes})
			`;
		} catch (error) {
			console.error(`Failed to log washer event for ${deviceId}:`, error);
		}
	}

	public async getHistory(
		deviceId: string,
		timeframeMs?: number
	): Promise<WasherEvent[]> {
		try {
			const cutoffTime = timeframeMs ? Date.now() - timeframeMs : 0;
			const results = await this._sqlDB<
				Array<{
					timestamp: number;
					machine_state: string | null;
					done: number | null;
					progress_percent: number | null;
					phase: string | null;
					remaining_time_minutes: number | null;
				}>
			>`
				SELECT timestamp, machine_state, done, progress_percent, phase, remaining_time_minutes
				FROM washer_events
				WHERE device_id = ${deviceId}
				AND timestamp >= ${cutoffTime}
				ORDER BY timestamp DESC
			`;
			return results.map((row) => ({
				timestamp: row.timestamp,
				machineState: row.machine_state,
				done: row.done === null ? null : row.done === 1,
				progressPercent: row.progress_percent,
				phase: row.phase,
				remainingTimeMinutes: row.remaining_time_minutes,
			}));
		} catch (error) {
			console.error(`Failed to fetch washer history for ${deviceId}:`, error);
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
