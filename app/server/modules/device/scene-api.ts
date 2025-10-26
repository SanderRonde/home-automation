import {
	DeviceClusterName,
	DeviceColorControlCluster,
	DeviceLevelControlCluster,
	DeviceOnOffCluster,
	DeviceWindowCoveringCluster,
} from './cluster';
import type { Scene, SceneCondition, SceneId, SceneTrigger } from '../../../../types/scene';
import { SceneTriggerType, SceneConditionType } from '../../../../types/scene';
import { assertUnreachable } from '../../lib/assert';
import { logTag } from '../../lib/logging/logger';
import type { PaletteAPI } from './palette-api';
import type { Database } from '../../lib/db';
import type { AllModules } from '../modules';
import type { GroupAPI } from './group-api';
import type { Data } from '../../lib/data';
import { Color } from '../../lib/color';
import type { Device } from './device';
import type { DeviceDB } from '.';

export class SceneAPI {
	public constructor(
		private readonly _db: Database<DeviceDB>,
		private readonly _devices: Data<{
			[deviceId: string]: Device;
		}>,
		private readonly _groupAPI: GroupAPI,
		private readonly _paletteAPI: PaletteAPI,
		private readonly _modules: unknown
	) {}

	public listScenes(): Scene[] {
		const scenes = this._db.current().scenes ?? {};
		return Object.values(scenes);
	}

	public getScene(id: SceneId): Scene | undefined {
		const scenes = this._db.current().scenes ?? {};
		return scenes[id];
	}

	public createScene(scene: Omit<Scene, 'id'>): SceneId {
		const sceneId = `scene_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
		const newScene: Scene = {
			...scene,
			id: sceneId,
		};

		this._db.update((old) => ({
			...old,
			scenes: {
				...(old.scenes ?? {}),
				[sceneId]: newScene,
			},
		}));

		return sceneId;
	}

	public updateScene(id: SceneId, scene: Omit<Scene, 'id'>): boolean {
		const scenes = this._db.current().scenes ?? {};
		if (!scenes[id]) {
			return false;
		}

		this._db.update((old) => ({
			...old,
			scenes: {
				...(old.scenes ?? {}),
				[id]: {
					...scene,
					id,
				},
			},
		}));

		return true;
	}

	public deleteScene(id: SceneId): boolean {
		const scenes = this._db.current().scenes ?? {};
		if (!scenes[id]) {
			return false;
		}

		const newScenes = { ...scenes };
		delete newScenes[id];

		this._db.update((old) => ({
			...old,
			scenes: newScenes,
		}));

		return true;
	}

	private async _evaluateConditions(conditions: SceneCondition[] | undefined): Promise<boolean> {
		if (!conditions || conditions.length === 0) {
			return true;
		}

		const modules = (await this._modules) as AllModules;

		for (const condition of conditions) {
			if (condition.type === SceneConditionType.HOST_HOME) {
				const { HOME_STATE } = await import('../home-detector/types.js');
				const detector = await modules.homeDetector.getDetector();
				const hostState = detector.get(condition.hostId);

				if (hostState === '?') {
					logTag('scene', 'yellow', 'Host not found:', condition.hostId);
					return false;
				}

				const isHome = hostState === HOME_STATE.HOME;
				if (isHome !== condition.shouldBeHome) {
					return false;
				}
			} else if (condition.type === SceneConditionType.DEVICE_ON) {
				const device = this._devices.current()[condition.deviceId];
				if (!device) {
					logTag('scene', 'yellow', 'Device not found:', condition.deviceId);
					return false;
				}

				const onOffCluster = device.getClusterByType(DeviceOnOffCluster);
				if (!onOffCluster) {
					logTag('scene', 'yellow', 'OnOffCluster not found:', condition.deviceId);
					return false;
				}

				try {
					const isOn = (await onOffCluster.isOn.get()) ?? false;
					if (isOn !== condition.shouldBeOn) {
						return false;
					}
				} catch (error) {
					logTag(
						'scene',
						'yellow',
						'Failed to read device state:',
						condition.deviceId,
						error
					);
					return false;
				}
			} else {
				assertUnreachable(condition);
			}
		}

		return true;
	}

	public async onTrigger(trigger: SceneTrigger): Promise<void> {
		for (const scene of this.listScenes()) {
			const triggers = scene.triggers;
			if (!triggers || triggers.length === 0) {
				continue;
			}

			// Check each trigger (OR logic - any trigger can fire the scene)
			for (const triggerWithConditions of triggers) {
				const sceneTrigger = triggerWithConditions.trigger;

				// Check if trigger type matches
				if (sceneTrigger.type !== trigger.type) {
					continue;
				}

				// Match based on trigger type
				let triggerMatches = false;
				if (
					trigger.type === SceneTriggerType.OCCUPANCY &&
					sceneTrigger.type === SceneTriggerType.OCCUPANCY
				) {
					triggerMatches = sceneTrigger.deviceId === trigger.deviceId;
				} else if (
					trigger.type === SceneTriggerType.BUTTON_PRESS &&
					sceneTrigger.type === SceneTriggerType.BUTTON_PRESS
				) {
					triggerMatches =
						sceneTrigger.deviceId === trigger.deviceId &&
						sceneTrigger.buttonIndex === trigger.buttonIndex;
				} else if (
					trigger.type === SceneTriggerType.HOST_ARRIVAL &&
					sceneTrigger.type === SceneTriggerType.HOST_ARRIVAL
				) {
					triggerMatches = sceneTrigger.hostId === trigger.hostId;
				} else if (
					trigger.type === SceneTriggerType.HOST_DEPARTURE &&
					sceneTrigger.type === SceneTriggerType.HOST_DEPARTURE
				) {
					triggerMatches = sceneTrigger.hostId === trigger.hostId;
				} else if (
					trigger.type === SceneTriggerType.WEBHOOK &&
					sceneTrigger.type === SceneTriggerType.WEBHOOK
				) {
					triggerMatches = sceneTrigger.webhookName === trigger.webhookName;
				}

				if (!triggerMatches) {
					continue;
				}

				// Evaluate conditions (AND logic - all must pass)
				const conditionsPassed = await this._evaluateConditions(
					triggerWithConditions.conditions
				);

				if (conditionsPassed) {
					await this.triggerScene(scene.id);
					// Break after first matching trigger fires the scene
					break;
				}
			}
		}
	}

	public async triggerScene(id: SceneId): Promise<boolean> {
		const scene = this.getScene(id);
		if (!scene) {
			return false;
		}

		const success = (
			await Promise.all(
				scene.actions.map(async (sceneAction) => {
					// Handle HTTP request actions (no device/group needed)
					if (sceneAction.cluster === 'http-request') {
						try {
							const { url, method, body, headers } = sceneAction.action;
							logTag('scene', 'blue', `HTTP ${method} ${url}`);

							// eslint-disable-next-line no-restricted-globals
							const response = await fetch(url, {
								method,
								headers: {
									'Content-Type': 'application/json',
									...headers,
								},
								body: body && method === 'POST' ? JSON.stringify(body) : undefined,
							});

							if (!response.ok) {
								logTag(
									'scene',
									'red',
									`HTTP request failed: ${response.status} ${response.statusText}`
								);
								return false;
							}

							logTag('scene', 'green', `HTTP request successful: ${response.status}`);
							return true;
						} catch (error) {
							logTag('scene', 'red', 'HTTP request error:', error);
							return false;
						}
					}

					// Resolve devices: either single device or group of devices
					const devices: Device[] = [];

					if (sceneAction.deviceId) {
						const device = this._devices.current()[sceneAction.deviceId];
						if (!device) {
							logTag('scene', 'red', 'Device not found:', sceneAction.deviceId);
							return false;
						}
						devices.push(device);
					} else if (sceneAction.groupId) {
						const group = this._groupAPI.getGroup(sceneAction.groupId);
						if (!group) {
							logTag('scene', 'red', 'Group not found:', sceneAction.groupId);
							return false;
						}
						// Resolve group to devices that support the cluster
						for (const deviceId of group.deviceIds) {
							const device = this._devices.current()[deviceId];
							if (device) {
								devices.push(device);
							}
						}
					} else {
						logTag('scene', 'red', 'Action has neither deviceId nor groupId');
						return false;
					}

					// Handle palette actions for groups
					if (
						sceneAction.cluster === DeviceClusterName.COLOR_CONTROL &&
						'paletteId' in sceneAction.action &&
						sceneAction.groupId
					) {
						const palette = this._paletteAPI.getPalette(sceneAction.action.paletteId);
						if (!palette) {
							logTag(
								'scene',
								'red',
								'Palette not found:',
								sceneAction.action.paletteId
							);
							return false;
						}

						// Import and use palette executor
						const { applyPaletteToDevices } = await import('./palette-executor.js');
						const success = await applyPaletteToDevices(devices, palette);
						return success;
					}

					// Execute action on all devices
					const deviceResults = await Promise.all(
						devices.map(async (device) => {
							try {
								if (sceneAction.cluster === DeviceClusterName.ON_OFF) {
									const onOffClusters =
										device.getAllClustersByType(DeviceOnOffCluster);
									if (onOffClusters.length === 0) {
										logTag(
											'scene',
											'yellow',
											'OnOffCluster not found:',
											device.getUniqueId()
										);
										return false;
									}
									for (const onOffCluster of onOffClusters) {
										await onOffCluster.setOn(sceneAction.action.isOn);
									}
								} else if (
									sceneAction.cluster === DeviceClusterName.WINDOW_COVERING
								) {
									const windowCoveringClusters = device.getAllClustersByType(
										DeviceWindowCoveringCluster
									);
									if (windowCoveringClusters.length === 0) {
										logTag(
											'scene',
											'yellow',
											'WindowCoveringCluster not found:',
											device.getUniqueId()
										);
										return false;
									}
									for (const windowCoveringCluster of windowCoveringClusters) {
										await windowCoveringCluster.goToLiftPercentage({
											percentage:
												sceneAction.action.targetPositionLiftPercentage,
										});
									}
								} else if (
									sceneAction.cluster === DeviceClusterName.COLOR_CONTROL
								) {
									// Check if this is a palette action
									if ('paletteId' in sceneAction.action) {
										// Palette actions should only be used with groups
										if (!sceneAction.groupId) {
											logTag(
												'scene',
												'yellow',
												'Palette action used without group'
											);
											return false;
										}
										// Skip individual device processing for palette actions
										// They are handled at the group level below
										return true;
									}

									// Handle manual HSV color
									const colorControlClusters =
										device.getAllClustersByType(DeviceColorControlCluster);
									if (colorControlClusters.length === 0) {
										logTag(
											'scene',
											'yellow',
											'ColorControlCluster not found:',
											device.getUniqueId()
										);
										return false;
									}
									const color = Color.fromHSV(
										sceneAction.action.hue / 360,
										sceneAction.action.saturation / 100,
										sceneAction.action.value / 100
									);
									for (const colorControlCluster of colorControlClusters) {
										await colorControlCluster.setColor({ color });
									}
								} else if (
									sceneAction.cluster === DeviceClusterName.LEVEL_CONTROL
								) {
									const levelControlClusters =
										device.getAllClustersByType(DeviceLevelControlCluster);
									if (levelControlClusters.length === 0) {
										logTag(
											'scene',
											'yellow',
											'LevelControlCluster not found:',
											device.getUniqueId()
										);
										return false;
									}
									for (const levelControlCluster of levelControlClusters) {
										await levelControlCluster.setLevel({
											level: sceneAction.action.level / 100,
										});
									}
								} else {
									assertUnreachable(sceneAction);
								}
								return true;
							} catch (error) {
								logTag(
									'scene',
									'red',
									`Device control error for ${device.getUniqueId()}:`,
									error
								);
								return false;
							}
						})
					);

					// For groups, we consider it successful if at least one device succeeded
					return sceneAction.groupId
						? deviceResults.some((r) => r)
						: deviceResults.every((r) => r);
				})
			)
		).every((success) => success);

		if (!success) {
			logTag('scene', 'red', 'Scene execution failed:', id);
			return false;
		}

		return true;
	}
}
