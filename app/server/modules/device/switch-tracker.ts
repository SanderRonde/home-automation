import { SceneTriggerType } from '../../../../types/scene';
import type { Device as DeviceInterface } from './device';
import type { DeviceSwitchCluster } from './cluster';
import { DeviceClusterName } from './cluster';
import type { SceneAPI } from './scene-api';
import type { SQL } from 'bun';

export class SwitchTracker {
	private _subscriptions = new Map<string, () => void>();

	public constructor(
		private readonly _sqlDB: SQL,
		private readonly _sceneAPI: SceneAPI
	) {}

	public trackDevices(devices: DeviceInterface[]): void {
		for (const device of devices) {
			const deviceId = device.getUniqueId();

			// Skip if already tracking
			if (this._subscriptions.has(deviceId)) {
				continue;
			}

			// Find all switch clusters across all endpoints
			const allClusters = device.allClusters;
			const switchClusters = allClusters
				.filter(
					({ cluster }) =>
						cluster.getBaseCluster().clusterName === DeviceClusterName.SWITCH
				)
				.map(({ cluster }) => cluster as DeviceSwitchCluster);

			if (!switchClusters.length) {
				continue;
			}

			const unsubscribers: Array<() => void> = [];

			for (const switchCluster of switchClusters) {
				const buttonIndex = switchCluster.getIndex();

				// Subscribe to press events
				const unsubscribe = switchCluster.onPress.listen(() => {
					void this.logEvent(deviceId, buttonIndex);
					void this._sceneAPI.onTrigger({
						type: SceneTriggerType.BUTTON_PRESS,
						deviceId,
						buttonIndex,
					});
				});

				unsubscribers.push(unsubscribe);
			}

			// Store combined unsubscribe function
			this._subscriptions.set(deviceId, () => {
				for (const unsubscribe of unsubscribers) {
					unsubscribe();
				}
			});
		}
	}

	private async logEvent(deviceId: string, buttonIndex?: number): Promise<void> {
		try {
			await this._sqlDB`
				INSERT INTO button_press_events (device_id, button_index, timestamp)
				VALUES (${deviceId}, ${buttonIndex ?? null}, ${Date.now()})
			`;
		} catch (error) {
			console.error(`Failed to log button press event for ${deviceId}:`, error);
		}
	}

	public async getHistory(
		deviceId: string,
		buttonIndex?: number,
		limit = 100
	): Promise<Array<{ buttonIndex?: number; timestamp: number }>> {
		try {
			const results = await (buttonIndex !== undefined
				? this._sqlDB<Array<{ button_index: number | null; timestamp: number }>>`
					SELECT button_index, timestamp 
					FROM button_press_events 
					WHERE device_id = ${deviceId} AND button_index = ${buttonIndex}
					ORDER BY timestamp DESC
					LIMIT ${limit}
				`
				: this._sqlDB<Array<{ button_index: number | null; timestamp: number }>>`
					SELECT button_index, timestamp 
					FROM button_press_events 
					WHERE device_id = ${deviceId}
					ORDER BY timestamp DESC
					LIMIT ${limit}
				`);
			return results.map((r) => ({
				buttonIndex: r.button_index ?? undefined,
				timestamp: r.timestamp,
			}));
		} catch (error) {
			console.error(`Failed to fetch button press history for ${deviceId}:`, error);
			return [];
		}
	}

	public async getLastPressed(
		deviceId: string,
		buttonIndex?: number
	): Promise<{ timestamp: number } | null> {
		try {
			const results = await (buttonIndex !== undefined
				? this._sqlDB<
						{
							button_index: number | null;
							timestamp: number;
						}[]
					>`
					SELECT button_index, timestamp 
					FROM button_press_events 
					WHERE device_id = ${deviceId} AND button_index = ${buttonIndex}
					ORDER BY timestamp DESC
					LIMIT 1
				`
				: this._sqlDB<
						{
							button_index: number | null;
							timestamp: number;
						}[]
					>`
					SELECT button_index, timestamp 
					FROM button_press_events 
					WHERE device_id = ${deviceId}
					ORDER BY timestamp DESC
					LIMIT 1
				`);
			if (results.length > 0) {
				return {
					timestamp: results[0].timestamp,
				};
			}
		} catch (error) {
			console.error(`Failed to fetch last button press event for ${deviceId}:`, error);
		}
		return null;
	}
}
