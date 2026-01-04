import {
	DeviceClusterName,
	DeviceColorControlXYCluster,
	DeviceLevelControlCluster,
	DeviceOnOffCluster,
	DeviceWindowCoveringCluster,
} from './cluster';
import type {
	Scene,
	SceneCondition,
	SceneId,
	SceneTrigger,
	SceneExecution,
} from '../../../../types/scene';
import { SceneTriggerType, SceneConditionType } from '../../../../types/scene';
import { applyPaletteToDevices } from './palette-executor';
import { assertUnreachable } from '../../lib/assert';
import { HOME_STATE } from '../home-detector/types';
import { Temperature } from '../temperature/index';
import { logTag } from '../../lib/logging/logger';
import type { PaletteAPI } from './palette-api';
import type { Database } from '../../lib/db';
import type { AllModules } from '../modules';
import type { GroupAPI } from './group-api';
import type { Data } from '../../lib/data';
import { Color } from '../../lib/color';
import type { Device } from './device';
import type { DeviceDB } from '.';
import type { SQL } from 'bun';

const UPDATE_INTERVAL_SECONDS = 5;

const sandbox = (() => {
	// eslint-disable-next-line @typescript-eslint/require-await
	return async (code: string): Promise<unknown> => {
		// eslint-disable-next-line @typescript-eslint/no-implied-eval
		return new Function(code)();
	};
})();

export class SceneAPI {
	private _gradualLevelIntervals: Map<string, Timer> = new Map();
	private _gradualLevelSubscriptions: Map<string, Array<() => void>> = new Map();
	private _isUpdatingGradualLevels: Set<string> = new Set();
	private _onVariableChange?: () => void;

	public constructor(
		private readonly _db: Database<DeviceDB>,
		private readonly _devices: Data<{
			[deviceId: string]: Device;
		}>,
		private readonly _groupAPI: GroupAPI,
		private readonly _paletteAPI: PaletteAPI,
		private readonly _modules: unknown,
		private readonly _sqlDB: SQL
	) {}

	public setOnVariableChange(callback: () => void): void {
		this._onVariableChange = callback;
	}

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

	public getVariable(variableName: string): boolean | undefined {
		const variables = this._db.current().variables ?? {};
		return variables[variableName];
	}

	public setVariable(variableName: string, value: boolean): void {
		this._db.update((old) => ({
			...old,
			variables: {
				...(old.variables ?? {}),
				[variableName]: value,
			},
		}));
		if (this._onVariableChange) {
			this._onVariableChange();
		}
	}

	public clearVariable(variableName: string): void {
		const variables = this._db.current().variables ?? {};
		if (!(variableName in variables)) {
			return;
		}

		const newVariables = { ...variables };
		delete newVariables[variableName];

		this._db.update((old) => ({
			...old,
			variables: newVariables,
		}));
		if (this._onVariableChange) {
			this._onVariableChange();
		}
	}

	public getAllVariables(): Record<string, boolean> {
		return this._db.current().variables ?? {};
	}

	private async _evaluateConditions(
		conditions: SceneCondition[] | undefined,
		isManualTrigger = false
	): Promise<boolean> {
		if (!conditions || conditions.length === 0) {
			return true;
		}

		const modules = (await this._modules) as AllModules;

		// Filter conditions based on manual trigger
		const conditionsToCheck = isManualTrigger
			? conditions.filter((c) => c.checkOnManual === true)
			: conditions;

		// If manual trigger and no conditions have checkOnManual=true, pass
		if (isManualTrigger && conditionsToCheck.length === 0) {
			return true;
		}

		// AND logic - all conditions must pass
		for (const condition of conditionsToCheck) {
			if (condition.type === SceneConditionType.HOST_HOME) {
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
			} else if (condition.type === SceneConditionType.TIME_WINDOW) {
				const now = new Date();
				const currentDay = [
					'sunday',
					'monday',
					'tuesday',
					'wednesday',
					'thursday',
					'friday',
					'saturday',
				][now.getDay()] as keyof typeof condition.windows;
				const currentTime = now.getHours() * 60 + now.getMinutes(); // Minutes since midnight

				const window = condition.windows[currentDay];
				if (!window) {
					// No window for this day → condition passes (all-day)
					continue;
				}

				// Parse start and end times (HH:MM format)
				const [startHour, startMinute] = window.start.split(':').map(Number);
				const [endHour, endMinute] = window.end.split(':').map(Number);
				const startTime = startHour * 60 + startMinute;
				const endTime = endHour * 60 + endMinute;

				// Check if current time is within the window
				if (startTime <= endTime) {
					// Normal window (e.g., 09:00-17:00)
					if (currentTime < startTime || currentTime > endTime) {
						return false;
					}
				} else {
					// Overnight window (e.g., 22:00-06:00)
					if (currentTime < startTime && currentTime > endTime) {
						return false;
					}
				}
			} else if (condition.type === SceneConditionType.ANYONE_HOME) {
				const detector = await modules.homeDetector.getDetector();
				const anyHome = Object.values(detector.getAll()).some((s) => s === HOME_STATE.HOME);
				if (anyHome !== condition.shouldBeHome) {
					return false;
				}
			} else if (condition.type === SceneConditionType.CUSTOM_JS) {
				try {
					logTag('scene', 'blue', 'Evaluating custom JS condition');
					const result = await sandbox(condition.code);
					// The sandbox should return a boolean
					if (result === false) {
						logTag('scene', 'blue', 'Custom JS condition returned false');
						return false;
					}
					logTag('scene', 'green', 'Custom JS condition passed');
				} catch (error) {
					logTag('scene', 'red', 'Custom JS condition error:', error);
					return false;
				}
			} else if (condition.type === SceneConditionType.VARIABLE) {
				const variableValue = this.getVariable(condition.variableName);
				// Default to false if variable doesn't exist
				const isTrue = variableValue === true;
				let matches = isTrue === condition.shouldBeTrue;

				// Apply inversion if specified
				if (condition.invert) {
					matches = !matches;
				}

				if (!matches) {
					logTag(
						'scene',
						'yellow',
						`Variable condition failed: "${condition.variableName}" is ${isTrue}, expected ${condition.shouldBeTrue}${condition.invert ? ' (inverted)' : ''}`
					);
					return false;
				}

				logTag(
					'scene',
					'green',
					`Variable condition passed: "${condition.variableName}" is ${isTrue}`
				);
			} else {
				assertUnreachable(condition);
			}
		}

		return true;
	}

	public async onTrigger(trigger: SceneTrigger, skipConditions = false): Promise<void> {
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
				let triggerSource: string | undefined;
				if (
					trigger.type === SceneTriggerType.OCCUPANCY &&
					sceneTrigger.type === SceneTriggerType.OCCUPANCY
				) {
					triggerMatches =
						sceneTrigger.deviceId === trigger.deviceId &&
						sceneTrigger.occupied === trigger.occupied;
					triggerSource = `${trigger.deviceId}:${trigger.occupied ? 'occupied' : 'cleared'}`;
				} else if (
					trigger.type === SceneTriggerType.BUTTON_PRESS &&
					sceneTrigger.type === SceneTriggerType.BUTTON_PRESS
				) {
					triggerMatches =
						sceneTrigger.deviceId === trigger.deviceId &&
						sceneTrigger.buttonIndex === trigger.buttonIndex;
					triggerSource = `${trigger.deviceId}:${trigger.buttonIndex}`;
				} else if (
					trigger.type === SceneTriggerType.HOST_ARRIVAL &&
					sceneTrigger.type === SceneTriggerType.HOST_ARRIVAL
				) {
					triggerMatches = sceneTrigger.hostId === trigger.hostId;
					triggerSource = trigger.hostId;
				} else if (
					trigger.type === SceneTriggerType.HOST_DEPARTURE &&
					sceneTrigger.type === SceneTriggerType.HOST_DEPARTURE
				) {
					triggerMatches = sceneTrigger.hostId === trigger.hostId;
					triggerSource = trigger.hostId;
				} else if (
					trigger.type === SceneTriggerType.WEBHOOK &&
					sceneTrigger.type === SceneTriggerType.WEBHOOK
				) {
					triggerMatches = sceneTrigger.webhookName === trigger.webhookName;
					triggerSource = trigger.webhookName;
				} else if (
					trigger.type === SceneTriggerType.ANYBODY_HOME &&
					sceneTrigger.type === SceneTriggerType.ANYBODY_HOME
				) {
					triggerMatches = true;
					triggerSource = undefined;
				} else if (
					trigger.type === SceneTriggerType.NOBODY_HOME &&
					sceneTrigger.type === SceneTriggerType.NOBODY_HOME
				) {
					triggerMatches = true;
					triggerSource = undefined;
				} else if (
					trigger.type === SceneTriggerType.NOBODY_HOME_TIMEOUT &&
					sceneTrigger.type === SceneTriggerType.NOBODY_HOME_TIMEOUT
				) {
					triggerMatches = true;
					triggerSource = undefined;
				} else if (
					trigger.type === SceneTriggerType.CRON &&
					sceneTrigger.type === SceneTriggerType.CRON
				) {
					// For interval triggers, they match if they have the same interval
					triggerMatches = sceneTrigger.intervalMinutes === trigger.intervalMinutes;
					triggerSource = `Every ${trigger.intervalMinutes} min`;
				} else if (
					trigger.type === SceneTriggerType.LOCATION_WITHIN_RANGE &&
					sceneTrigger.type === SceneTriggerType.LOCATION_WITHIN_RANGE
				) {
					// Location triggers match if device, target, and range all match
					triggerMatches =
						sceneTrigger.deviceId === trigger.deviceId &&
						sceneTrigger.targetId === trigger.targetId &&
						sceneTrigger.rangeKm === trigger.rangeKm;
					triggerSource = `${trigger.deviceId} within ${trigger.rangeKm}km of ${trigger.targetId}`;
				}

				if (!triggerMatches) {
					continue;
				}

				// Evaluate conditions (AND logic - all must pass)
				// Skip conditions if explicitly told to (e.g., manual triggers with checkConditionsOnManual=false)
				const shouldCheckConditions = !skipConditions;
				const conditionsPassed = shouldCheckConditions
					? await this._evaluateConditions(triggerWithConditions.conditions)
					: true;

				if (conditionsPassed) {
					await this.triggerScene(scene.id, {
						type: trigger.type,
						source: triggerSource,
					});
					// Break after first matching trigger fires the scene
					break;
				}
			}
		}
	}

	public async triggerScene(
		id: SceneId,
		triggerInfo?: {
			type: 'manual' | SceneTriggerType;
			source?: string;
		}
	): Promise<boolean> {
		const scene = this.getScene(id);
		if (!scene) {
			return false;
		}

		// If manually triggered, check conditions that have checkOnManual=true
		if (triggerInfo?.type === 'manual' && scene.triggers && scene.triggers.length > 0) {
			// Check if any trigger's conditions with checkOnManual pass
			let anyConditionsPassed = false;
			for (const triggerWithConditions of scene.triggers) {
				const conditionsPassed = await this._evaluateConditions(
					triggerWithConditions.conditions,
					true // isManualTrigger
				);
				if (conditionsPassed) {
					anyConditionsPassed = true;
					break;
				}
			}

			if (!anyConditionsPassed) {
				logTag(
					'scene',
					'yellow',
					`Scene "${scene.title}" conditions not met for manual trigger`
				);
				return false;
			}
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

					// Handle notification action
					if (sceneAction.cluster === 'notification') {
						try {
							const { title, body } = sceneAction.action;
							logTag('scene', 'blue', 'Sending notification:', title);
							await (
								(await this._modules) as AllModules
							).notification.sendNotification(title, body);
							logTag('scene', 'green', 'Notification sent successfully');
							return true;
						} catch (error) {
							logTag('scene', 'red', 'Notification send error:', error);
							return false;
						}
					}

					// Handle room temperature action
					if (sceneAction.cluster === 'room-temperature') {
						try {
							const { roomName, mode, targetTemperature, stateId } =
								sceneAction.action;
							logTag('scene', 'blue', `Room temperature action: ${mode}`);

							if (mode === 'setTarget') {
								if (!roomName || targetTemperature === undefined) {
									logTag(
										'scene',
										'red',
										'Room temperature setTarget requires roomName and targetTemperature'
									);
									return false;
								}
								Temperature.setRoomOverride(roomName, targetTemperature);
								logTag(
									'scene',
									'green',
									`Set room ${roomName} to ${targetTemperature}°C`
								);
							} else if (mode === 'returnToSchedule') {
								if (roomName) {
									Temperature.setRoomOverride(roomName, null);
									logTag(
										'scene',
										'green',
										`Returned room ${roomName} to schedule`
									);
								}
								// Also clear scene-activated state
								Temperature.activateState(null);
								logTag('scene', 'green', 'Returned to time-based schedule');
							} else if (mode === 'activateState') {
								if (!stateId) {
									logTag(
										'scene',
										'red',
										'Room temperature activateState requires stateId'
									);
									return false;
								}
								Temperature.activateState(stateId);
								const state = Temperature.getState(stateId);
								const stateName = state ? state.name : stateId;
								logTag(
									'scene',
									'green',
									`Activated temperature state: ${stateName}`
								);
							}

							return true;
						} catch (error) {
							logTag('scene', 'red', 'Room temperature update error:', error);
							return false;
						}
					}

					// Handle set variable action
					if (sceneAction.cluster === 'set-variable') {
						try {
							const { variableName, value } = sceneAction.action;
							logTag(
								'scene',
								'blue',
								`Setting variable "${variableName}" to ${value}`
							);
							this.setVariable(variableName, value);
							logTag('scene', 'green', `Variable "${variableName}" set to ${value}`);
							return true;
						} catch (error) {
							logTag('scene', 'red', 'Set variable error:', error);
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
						const excludeSet = new Set(sceneAction.excludeDeviceIds || []);
						for (const deviceId of group.deviceIds) {
							if (!excludeSet.has(deviceId)) {
								const device = this._devices.current()[deviceId];
								if (device) {
									devices.push(device);
								}
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

						// Use palette executor
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
									const colorControlClusters = device.getAllClustersByType(
										DeviceColorControlXYCluster
									);
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
										await colorControlCluster.setColor({ colors: [color] });
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

									// Check if gradual level increase is requested
									if (
										sceneAction.action.durationSeconds &&
										sceneAction.action.durationSeconds > 0
									) {
										// Use gradual level increase
										await this._startGradualLevelIncrease(
											device,
											levelControlClusters,
											sceneAction.action.level / 100,
											sceneAction.action.durationSeconds
										);
									} else {
										// Immediate level set
										for (const levelControlCluster of levelControlClusters) {
											await levelControlCluster.setLevel({
												level: sceneAction.action.level / 100,
											});
										}
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

		// Log scene execution to database
		try {
			const triggerType = triggerInfo?.type ?? 'manual';
			const triggerSource = triggerInfo?.source ?? null;
			await this._sqlDB`
				INSERT INTO scene_executions (scene_id, scene_title, timestamp, trigger_type, trigger_source, success)
				VALUES (${id}, ${scene.title}, ${Date.now()}, ${triggerType}, ${triggerSource}, ${success ? 1 : 0})
			`;
		} catch (error) {
			logTag('scene', 'red', 'Failed to log scene execution:', error);
		}

		if (!success) {
			logTag('scene', 'red', 'Scene execution failed:', id);
			return false;
		}

		return true;
	}

	private async _startGradualLevelIncrease(
		device: Device,
		levelControlClusters: DeviceLevelControlCluster[],
		targetLevel: number,
		durationSeconds: number
	): Promise<void> {
		const deviceId = device.getUniqueId();

		// Cancel any existing gradual level increase for this device
		this._cancelGradualLevelIncrease(deviceId);

		// Get current level
		let startLevel = 0;
		try {
			const currentLevel = await levelControlClusters[0].currentLevel.get();
			if (currentLevel !== null && currentLevel !== undefined) {
				startLevel = currentLevel;
			}
		} catch (error) {
			logTag('scene', 'yellow', `Failed to get current level for ${deviceId}:`, error);
		}

		// Ensure device is on if it has OnOff cluster
		const onOffCluster = device.getClusterByType(DeviceOnOffCluster);
		if (onOffCluster) {
			try {
				const isOn = await onOffCluster.isOn.get();
				if (!isOn) {
					await onOffCluster.setOn(true);
				}
			} catch (error) {
				logTag('scene', 'yellow', `Failed to turn on device ${deviceId}:`, error);
			}
		}

		const startTime = Date.now();
		const totalDurationMs = durationSeconds * 1000;
		const updateIntervalMs = UPDATE_INTERVAL_SECONDS * 1000;

		// Subscribe to device changes to detect manual intervention
		this._subscribeToGradualLevelChanges(device, deviceId, () => {
			// Only cancel if the change wasn't triggered by our own updates
			if (!this._isUpdatingGradualLevels.has(deviceId)) {
				logTag(
					'scene',
					'yellow',
					`Manual device change detected for ${deviceId}, cancelling gradual level increase`
				);
				this._cancelGradualLevelIncrease(deviceId);
			}
		});

		// Set up interval to update level
		const intervalId = setInterval(() => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / totalDurationMs, 1.0);

			// Linear interpolation from startLevel to targetLevel
			const currentLevel = startLevel + (targetLevel - startLevel) * progress;

			void this._updateGradualLevel(deviceId, levelControlClusters, currentLevel);

			// Stop when complete
			if (progress >= 1.0) {
				logTag('scene', 'green', `Gradual level increase complete for ${deviceId}`);
				this._cancelGradualLevelIncrease(deviceId);
			}
		}, updateIntervalMs);

		this._gradualLevelIntervals.set(deviceId, intervalId);

		// Set initial level
		await this._updateGradualLevel(deviceId, levelControlClusters, startLevel);
	}

	private async _updateGradualLevel(
		deviceId: string,
		levelControlClusters: DeviceLevelControlCluster[],
		level: number
	): Promise<void> {
		// Set flag to prevent self-cancellation
		this._isUpdatingGradualLevels.add(deviceId);

		try {
			await Promise.all(
				levelControlClusters.map(async (levelControlCluster) => {
					try {
						await levelControlCluster.setLevel({ level });
					} catch (error) {
						logTag('scene', 'yellow', `Failed to update level for ${deviceId}:`, error);
					}
				})
			);
		} finally {
			// Reset flag after updates complete
			this._isUpdatingGradualLevels.delete(deviceId);
		}
	}

	private _subscribeToGradualLevelChanges(
		device: Device,
		deviceId: string,
		onChangeCallback: () => void
	): void {
		const subscriptions: Array<() => void> = [];

		// Subscribe to OnOff changes
		const onOffCluster = device.getClusterByType(DeviceOnOffCluster);
		if (onOffCluster) {
			const unsubscribe = onOffCluster.isOn.subscribe(() => {
				onChangeCallback();
			});
			subscriptions.push(unsubscribe);
		}

		// Subscribe to LevelControl changes
		const levelControlClusters = device.getAllClustersByType(DeviceLevelControlCluster);
		for (const levelControlCluster of levelControlClusters) {
			const unsubscribe = levelControlCluster.currentLevel.subscribe(() => {
				onChangeCallback();
			});
			subscriptions.push(unsubscribe);
		}

		this._gradualLevelSubscriptions.set(deviceId, subscriptions);
	}

	private _cancelGradualLevelIncrease(deviceId: string): void {
		// Clear interval
		const intervalId = this._gradualLevelIntervals.get(deviceId);
		if (intervalId !== undefined) {
			clearInterval(intervalId);
			this._gradualLevelIntervals.delete(deviceId);
		}

		// Unsubscribe from device changes
		const subscriptions = this._gradualLevelSubscriptions.get(deviceId);
		if (subscriptions) {
			for (const unsubscribe of subscriptions) {
				unsubscribe();
			}
			this._gradualLevelSubscriptions.delete(deviceId);
		}

		// Clear update flag
		this._isUpdatingGradualLevels.delete(deviceId);
	}

	public async getSceneHistory(limit = 100, sceneId?: SceneId): Promise<SceneExecution[]> {
		try {
			let results;
			if (sceneId) {
				results = await this._sqlDB<
					Array<{
						id: number;
						scene_id: string;
						scene_title: string;
						timestamp: number;
						trigger_type: string;
						trigger_source: string | null;
						success: number;
					}>
				>`
					SELECT id, scene_id, scene_title, timestamp, trigger_type, trigger_source, success
					FROM scene_executions
					WHERE scene_id = ${sceneId}
					ORDER BY timestamp DESC
					LIMIT ${limit}
				`;
			} else {
				results = await this._sqlDB<
					Array<{
						id: number;
						scene_id: string;
						scene_title: string;
						timestamp: number;
						trigger_type: string;
						trigger_source: string | null;
						success: number;
					}>
				>`
					SELECT id, scene_id, scene_title, timestamp, trigger_type, trigger_source, success
					FROM scene_executions
					ORDER BY timestamp DESC
					LIMIT ${limit}
				`;
			}

			return results.map((r) => ({
				id: r.id,
				scene_id: r.scene_id,
				scene_title: r.scene_title,
				timestamp: r.timestamp,
				trigger_type: r.trigger_type as 'manual' | SceneTriggerType,
				trigger_source: r.trigger_source,
				success: r.success === 1,
			}));
		} catch (error) {
			logTag('scene', 'red', 'Failed to fetch scene history:', error);
			return [];
		}
	}
}
