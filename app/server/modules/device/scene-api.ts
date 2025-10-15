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
import type { Database } from '../../lib/db';
import type { Data } from '../../lib/data';
import { Color } from '../../lib/color';
import type { Device } from './device';
import type { DeviceDB } from '.';

export class SceneAPI {
	public constructor(
		private readonly _db: Database<DeviceDB>,
		private readonly _devices: Data<{
			[deviceId: string]: Device;
		}>
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
			if (
				scene.trigger?.type === trigger.type &&
				scene.trigger?.deviceId === trigger.deviceId
			) {
				await this.triggerScene(scene.id);
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
					const device = this._devices.current()[sceneAction.deviceId];
					if (!device) {
						logTag('scene', 'red', 'Device not found:', sceneAction.deviceId);
						return false;
					}
					if (sceneAction.cluster === DeviceClusterName.ON_OFF) {
						const onOffCluster = device.getClusterByType(DeviceOnOffCluster);
						if (!onOffCluster) {
							logTag('scene', 'red', 'OnOffCluster not found:', sceneAction.deviceId);
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
								'red',
								'WindowCoveringCluster not found:',
								sceneAction.deviceId
							);
							return false;
						}
						await windowCoveringCluster.goToLiftPercentage({
							percentage: sceneAction.action.targetPositionLiftPercentage,
						});
					} else if (sceneAction.cluster === DeviceClusterName.COLOR_CONTROL) {
						const colorControlCluster =
							device.getClusterByType(DeviceColorControlCluster);
						if (!colorControlCluster) {
							logTag(
								'scene',
								'red',
								'ColorControlCluster not found:',
								sceneAction.deviceId
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
			)
		).every((success) => success);

		if (!success) {
			logTag('scene', 'red', 'Scene execution failed:', id);
			return false;
		}

		return true;
	}
}
