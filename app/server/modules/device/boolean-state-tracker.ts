import type { Device as DeviceInterface } from './device';
import { DeviceBooleanStateCluster } from './cluster';
import type { SQL } from 'bun';

export class BooleanStateTracker {
	private _subscriptions = new Map<string, () => void>();

	public constructor(private readonly _sqlDB: SQL) {}

	public trackDevices(devices: DeviceInterface[]): void {
		for (const device of devices) {
			const deviceId = device.getUniqueId();

			// Skip if already tracking
			if (this._subscriptions.has(deviceId)) {
				continue;
			}

			// Find boolean state cluster
			const booleanStateClusters = device.getAllClustersByType(DeviceBooleanStateCluster);
			if (!booleanStateClusters.length) {
				continue;
			}

			for (const booleanStateCluster of booleanStateClusters) {
				let lastState: boolean | undefined = undefined;

				// Subscribe to state changes
				const unsubscribe = booleanStateCluster.state.subscribe((state, isInitial) => {
					if (state === undefined) {
						return;
					}
					// Log all state changes except initial
					if (!isInitial && lastState !== state) {
						void this.logEvent(deviceId, state);
					}
					lastState = state;
				});

				this._subscriptions.set(deviceId, unsubscribe);
			}
		}
	}

	private async logEvent(deviceId: string, state: boolean): Promise<void> {
		try {
			// Check if last logged state is the same - prevent duplicates
			const lastEvent = await this._sqlDB<Array<{ state: number }>>`
				SELECT state FROM boolean_state_events 
				WHERE device_id = ${deviceId}
				ORDER BY timestamp DESC LIMIT 1
			`;
			if (lastEvent.length > 0 && (lastEvent[0].state === 1) === state) {
				return; // Skip duplicate
			}

			await this._sqlDB`
				INSERT INTO boolean_state_events (device_id, state, timestamp)
				VALUES (${deviceId}, ${state ? 1 : 0}, ${Date.now()})
			`;
		} catch (error) {
			console.error(`Failed to log boolean state event for ${deviceId}:`, error);
		}
	}

	public async getHistory(
		deviceId: string,
		days = 7
	): Promise<Array<{ state: boolean; timestamp: number }>> {
		try {
			const since = Date.now() - days * 24 * 60 * 60 * 1000;
			const results = await this._sqlDB<Array<{ state: number; timestamp: number }>>`
				SELECT state, timestamp 
				FROM boolean_state_events 
				WHERE device_id = ${deviceId} AND timestamp >= ${since}
				ORDER BY timestamp DESC
			`;
			return results.map((r) => ({
				state: r.state === 1,
				timestamp: r.timestamp,
			}));
		} catch (error) {
			console.error(`Failed to fetch boolean state history for ${deviceId}:`, error);
			return [];
		}
	}

	public async getLastChanged(deviceId: string): Promise<{ timestamp: number } | null> {
		try {
			// Find the timestamp of the last actual state change (where state differs from previous)
			const results = await this._sqlDB<
				{
					timestamp: number;
				}[]
			>`
				WITH ranked AS (
					SELECT state, timestamp, 
						   LAG(state) OVER (ORDER BY timestamp DESC) as prev_state
					FROM boolean_state_events 
					WHERE device_id = ${deviceId}
				)
				SELECT timestamp FROM ranked 
				WHERE prev_state IS NULL OR state != prev_state
				ORDER BY timestamp DESC LIMIT 1
			`;
			if (results.length > 0) {
				return {
					timestamp: results[0].timestamp,
				};
			}
		} catch (error) {
			console.error(`Failed to fetch last boolean state change for ${deviceId}:`, error);
		}
		return null;
	}

	public destroy(): void {
		for (const unsubscribe of this._subscriptions.values()) {
			unsubscribe();
		}
		this._subscriptions.clear();
	}
}
