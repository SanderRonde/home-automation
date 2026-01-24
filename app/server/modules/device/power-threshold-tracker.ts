import { DeviceElectricalPowerMeasurementCluster } from './cluster';
import { SceneTriggerType } from '../../../../types/scene';
import type { Device as DeviceInterface } from './device';
import type { SceneAPI } from './scene-api';

// Hysteresis to prevent rapid toggling near threshold boundary
const HYSTERESIS_WATTS = 1;

interface ThresholdConfig {
	deviceId: string;
	thresholdWatts: number;
	direction: 'above' | 'below';
}

export class PowerThresholdTracker {
	private _subscriptions = new Map<string, () => void>();
	private _devices = new Map<string, DeviceInterface>();
	// Track whether we're above each threshold: key = `${deviceId}:${thresholdWatts}:${direction}`
	private _thresholdStates = new Map<string, boolean>();

	public constructor(private readonly _sceneAPI: SceneAPI) {}

	private _getThresholdKey(config: ThresholdConfig): string {
		return `${config.deviceId}:${config.thresholdWatts}:${config.direction}`;
	}

	private _getConfiguredThresholds(): ThresholdConfig[] {
		const thresholds: ThresholdConfig[] = [];
		const scenes = this._sceneAPI.listScenes();

		for (const scene of scenes) {
			if (!scene.triggers) {
				continue;
			}

			for (const triggerWithConditions of scene.triggers) {
				const trigger = triggerWithConditions.trigger;
				if (trigger.type === SceneTriggerType.POWER_THRESHOLD) {
					thresholds.push({
						deviceId: trigger.deviceId,
						thresholdWatts: trigger.thresholdWatts,
						direction: trigger.direction,
					});
				}
			}
		}

		return thresholds;
	}

	private _checkThresholds(deviceId: string, power: number): void {
		const thresholds = this._getConfiguredThresholds();
		const deviceThresholds = thresholds.filter((t) => t.deviceId === deviceId);

		for (const config of deviceThresholds) {
			const key = this._getThresholdKey(config);
			const previousState = this._thresholdStates.get(key);

			// Calculate if we're currently above the threshold
			// Use hysteresis to prevent rapid toggling
			let isAbove: boolean;
			if (previousState === undefined) {
				// First reading - no hysteresis needed
				isAbove = power >= config.thresholdWatts;
			} else if (previousState) {
				// Currently above - need to drop below threshold minus hysteresis
				isAbove = power >= config.thresholdWatts - HYSTERESIS_WATTS;
			} else {
				// Currently below - need to rise above threshold plus hysteresis
				isAbove = power >= config.thresholdWatts + HYSTERESIS_WATTS;
			}

			// Check if state changed
			if (previousState !== isAbove) {
				this._thresholdStates.set(key, isAbove);

				// Determine if we should trigger based on direction
				const shouldTrigger =
					(config.direction === 'above' && isAbove) ||
					(config.direction === 'below' && !isAbove);

				if (shouldTrigger && previousState !== undefined) {
					// Only trigger on state transitions (not initial state)
					void this._sceneAPI.onTrigger({
						type: SceneTriggerType.POWER_THRESHOLD,
						deviceId: config.deviceId,
						thresholdWatts: config.thresholdWatts,
						direction: config.direction,
					});
				}
			}
		}
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

			// Store device reference
			this._devices.set(deviceId, device);

			for (const powerCluster of powerClusters) {
				// Subscribe to power changes
				const unsubscribe = powerCluster.activePower.subscribe((power) => {
					if (power === undefined) {
						return;
					}
					this._checkThresholds(deviceId, power);
				});

				this._subscriptions.set(deviceId, unsubscribe);
			}
		}
	}

	public destroy(): void {
		for (const unsubscribe of this._subscriptions.values()) {
			unsubscribe();
		}
		this._subscriptions.clear();
		this._devices.clear();
		this._thresholdStates.clear();
	}
}
