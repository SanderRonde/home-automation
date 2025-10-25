import {
	DeviceClusterName,
	DeviceColorControlCluster,
	DeviceLevelControlCluster,
	DeviceOnOffCluster,
	DeviceWindowCoveringCluster,
} from './cluster';
import type { Scene, SceneId, SceneTrigger } from '../../../../types/scene';
import { assertUnreachable } from '../../lib/assert';
import { logTag } from '../../lib/logging/logger';
import type { PaletteAPI } from './palette-api';
import type { Database } from '../../lib/db';
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
		private readonly _paletteAPI: PaletteAPI
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

	public async onTrigger(trigger: SceneTrigger): Promise<void> {
		for (const scene of this.listScenes()) {
			if (!scene.trigger || scene.trigger.type !== trigger.type) {
				continue;
			}

			// Match based on trigger type
			if (trigger.type === 'occupancy' && scene.trigger.type === 'occupancy') {
				if (scene.trigger.deviceId !== trigger.deviceId) {
					continue;
				}
			} else if (trigger.type === 'button-press' && scene.trigger.type === 'button-press') {
				if (scene.trigger.deviceId !== trigger.deviceId) {
					continue;
				}
				if (scene.trigger.buttonIndex !== trigger.buttonIndex) {
					continue;
				}
			} else if (trigger.type === 'host-arrival' && scene.trigger.type === 'host-arrival') {
				if (scene.trigger.hostId !== trigger.hostId) {
					continue;
				}
			} else if (
				trigger.type === 'host-departure' &&
				scene.trigger.type === 'host-departure'
			) {
				if (scene.trigger.hostId !== trigger.hostId) {
					continue;
				}
			}

			await this.triggerScene(scene.id);
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
							if (sceneAction.cluster === DeviceClusterName.ON_OFF) {
								const onOffCluster = device.getClusterByType(DeviceOnOffCluster);
								if (!onOffCluster) {
									logTag(
										'scene',
										'yellow',
										'OnOffCluster not found:',
										device.getUniqueId()
									);
									return false;
								}
								await onOffCluster.setOn(sceneAction.action.isOn);
							} else if (sceneAction.cluster === DeviceClusterName.WINDOW_COVERING) {
								const windowCoveringCluster = device.getClusterByType(
									DeviceWindowCoveringCluster
								);
								if (!windowCoveringCluster) {
									logTag(
										'scene',
										'yellow',
										'WindowCoveringCluster not found:',
										device.getUniqueId()
									);
									return false;
								}
								await windowCoveringCluster.goToLiftPercentage({
									percentage: sceneAction.action.targetPositionLiftPercentage,
								});
							} else if (sceneAction.cluster === DeviceClusterName.COLOR_CONTROL) {
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
								const colorControlCluster =
									device.getClusterByType(DeviceColorControlCluster);
								if (!colorControlCluster) {
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
								await colorControlCluster.setColor({ color });
							} else if (sceneAction.cluster === DeviceClusterName.LEVEL_CONTROL) {
								const levelControlCluster =
									device.getClusterByType(DeviceLevelControlCluster);
								if (!levelControlCluster) {
									logTag(
										'scene',
										'yellow',
										'LevelControlCluster not found:',
										device.getUniqueId()
									);
									return false;
								}
								await levelControlCluster.setLevel({
									level: sceneAction.action.level / 100,
								});
							} else {
								assertUnreachable(sceneAction);
							}
							return true;
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
