/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-duplicate-type-constituents */
import type {
	Cluster,
	DevicePowerSourceCluster,
	DeviceOccupancySensingCluster,
	DeviceTemperatureMeasurementCluster,
	DeviceRelativeHumidityMeasurementCluster,
	DeviceIlluminanceMeasurementCluster,
	DeviceBooleanStateCluster,
	DeviceSwitchCluster,
} from './cluster';
import {
	DeviceOnOffCluster,
	DeviceClusterName,
	DeviceWindowCoveringCluster,
	DeviceColorControlCluster,
	DeviceLevelControlCluster,
	DeviceActionsCluster,
	DeviceThermostatCluster,
	ThermostatMode,
} from './cluster';
import type { IncludedIconNames } from '../../../client/dashboard/components/icon';
import type { BrandedRouteHandlerResponse, ServeOptions } from '../../lib/routes';
import { SceneTriggerType, SceneConditionType } from '../../../../types/scene';
import { createServeOptions, withRequestBody } from '../../lib/routes';
import type { Device, DeviceEndpoint, DeviceSource } from './device';
import type { DeviceGroup } from '../../../../types/group';
import { applyPaletteToDevices } from './palette-executor';
import type { AllModules, ModuleConfig } from '..';
import { logTag } from '../../lib/logging/logger';
import { Actions } from '@matter/main/clusters';
import type { ClassEnum } from '../../lib/enum';
import { Color } from '../../lib/color';
import type { DeviceAPI } from './api';
import { wait } from '../../lib/time';
import * as z from 'zod';

export interface DeviceInfo {
	id: string;
	status: 'online' | 'offline' | 'unknown';
	lastSeen: number; // timestamp
	name?: string;
	room?: string;
}

export interface RoomInfo {
	name: string;
	color: string; // Pastel color based on name hash
	icon?: IncludedIconNames;
}

type DashboardDeviceClusterBase = {
	name: DeviceClusterName;
	icon?: IncludedIconNames;
};

export type DashboardDeviceClusterOnOff = DashboardDeviceClusterBase & {
	name: DeviceClusterName.ON_OFF;
	isOn: boolean;
};

export type DashboardDeviceClusterWindowCovering = DashboardDeviceClusterBase & {
	name: DeviceClusterName.WINDOW_COVERING;
	targetPositionLiftPercentage: number;
};

export type DashboardDeviceClusterPowerSource = DashboardDeviceClusterBase & {
	name: DeviceClusterName.POWER_SOURCE;
	batteryPercentage?: number;
};

export type DashboardDeviceClusterOccupancySensing = DashboardDeviceClusterBase & {
	name: DeviceClusterName.OCCUPANCY_SENSING;
	occupied: boolean;
	lastTriggered?: number;
};

export type DashboardDeviceClusterTemperatureMeasurement = DashboardDeviceClusterBase & {
	name: DeviceClusterName.TEMPERATURE_MEASUREMENT;
	temperature: number;
	lastUpdated?: number;
};

export type DashboardDeviceClusterRelativeHumidityMeasurement = DashboardDeviceClusterBase & {
	name: DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT;
	humidity: number;
	lastUpdated?: number;
};

export type DashboardDeviceClusterIlluminanceMeasurement = DashboardDeviceClusterBase & {
	name: DeviceClusterName.ILLUMINANCE_MEASUREMENT;
	illuminance: number;
	lastUpdated?: number;
};

export type DashboardDeviceClusterBooleanState = DashboardDeviceClusterBase & {
	name: DeviceClusterName.BOOLEAN_STATE;
	state: boolean;
	lastChanged?: number;
};

export type DashboardDeviceClusterSwitch = DashboardDeviceClusterBase & {
	name: DeviceClusterName.SWITCH;
	label: string;
	index: number;
	totalCount: number;
};

export type DashboardDeviceClusterLevelControl = DashboardDeviceClusterBase & {
	name: DeviceClusterName.LEVEL_CONTROL;
	currentLevel: number; // 0-100
};

export type DashboardDeviceClusterActions = DashboardDeviceClusterBase & {
	name: DeviceClusterName.ACTIONS;
	actions: Array<{
		id: number;
		name: string;
		type: Actions.ActionType;
		state: Actions.ActionState;
	}>;
	activeActionId?: number;
};

export type DashboardDeviceClusterColorControl = DashboardDeviceClusterBase & {
	name: DeviceClusterName.COLOR_CONTROL;
	color: {
		hue: number;
		saturation: number;
		value: number; // Only used if no LevelControl available
	};
	mergedClusters: {
		[DeviceClusterName.ON_OFF]?: DashboardDeviceClusterOnOff;
		[DeviceClusterName.LEVEL_CONTROL]?: DashboardDeviceClusterLevelControl;
		[DeviceClusterName.ACTIONS]?: DashboardDeviceClusterActions;
	};
};

export type DashboardDeviceClusterSensorGroup = DashboardDeviceClusterBase & {
	name: DeviceClusterName.OCCUPANCY_SENSING;
	mergedClusters: {
		[DeviceClusterName.OCCUPANCY_SENSING]?: DashboardDeviceClusterOccupancySensing;
		[DeviceClusterName.TEMPERATURE_MEASUREMENT]?: DashboardDeviceClusterTemperatureMeasurement;
		[DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT]?: DashboardDeviceClusterRelativeHumidityMeasurement;
		[DeviceClusterName.ILLUMINANCE_MEASUREMENT]?: DashboardDeviceClusterIlluminanceMeasurement;
	};
};

export type DashboardDeviceClusterThermostat = DashboardDeviceClusterBase & {
	name: DeviceClusterName.THERMOSTAT;
	currentTemperature: number;
	targetTemperature: number;
	mode: ThermostatMode;
	isHeating: boolean;
	minTemperature: number;
	maxTemperature: number;
};

export type DashboardDeviceClusterWithState = DashboardDeviceClusterBase &
	(
		| DashboardDeviceClusterOnOff
		| DashboardDeviceClusterWindowCovering
		| DashboardDeviceClusterPowerSource
		| DashboardDeviceClusterOccupancySensing
		| DashboardDeviceClusterTemperatureMeasurement
		| DashboardDeviceClusterRelativeHumidityMeasurement
		| DashboardDeviceClusterIlluminanceMeasurement
		| DashboardDeviceClusterBooleanState
		| DashboardDeviceClusterSwitch
		| DashboardDeviceClusterLevelControl
		| DashboardDeviceClusterColorControl
		| DashboardDeviceClusterActions
		| DashboardDeviceClusterThermostat
		| DashboardDeviceClusterSensorGroup
	);

export type DashboardDeviceClusterWithStateMap<D extends DeviceClusterName = DeviceClusterName> = {
	[K in D]?: DashboardDeviceClusterWithState & {
		name: K;
	};
};

interface DashboardDeviceEndpointResponse {
	name: string;
	childClusters: DashboardDeviceClusterWithState[];
	endpoints: DashboardDeviceEndpointResponse[];
	mergedAllClusters: DashboardDeviceClusterWithState[];
	flatAllClusters: DashboardDeviceClusterWithState[];
}

interface DashboardDeviceResponse extends DashboardDeviceEndpointResponse {
	uniqueId: string;
	name: string;
	source: {
		name: DeviceSource extends ClassEnum<infer T> ? T : never;
		emoji: string;
	};
	childClusters: DashboardDeviceClusterWithState[];
	room?: string;
	roomColor?: string;
	roomIcon?: IncludedIconNames;
	managementUrl?: string;
}

function _initRouting({ db, modules, wsPublish: _wsPublish }: ModuleConfig, api: DeviceAPI) {
	const wsPublish = (data: DeviceWebsocketServerMessage) => {
		void _wsPublish(JSON.stringify(data));
	};

	const notifyDeviceChanges = async () => {
		void wsPublish({
			type: 'devices',
			devices: await listDevicesWithValues(api, modules),
		});
	};

	// Subscribe to device changes and notify via WebSocket
	const subscribedDevices = new Set<Device>();
	api.devices.subscribe((devices) => {
		if (!devices) {
			return;
		}
		let didChange = Object.keys(devices).length !== subscribedDevices.size;
		for (const device of Object.values(devices)) {
			if (subscribedDevices.has(device)) {
				continue;
			}
			subscribedDevices.add(device);
			device.onChange.listen(() => void notifyDeviceChanges());
			didChange = true;
		}

		if (didChange) {
			void notifyDeviceChanges();
		}
	});

	return createServeOptions(
		{
			'/list': async (_req, _server, { json }) => {
				const currentDeviceIds = Object.keys(await api.devices.get());
				const knownDevices = api.getStoredDevices();
				const now = Date.now();

				// Update current devices status
				for (const deviceId of currentDeviceIds) {
					knownDevices[deviceId] = {
						...knownDevices[deviceId],
						id: deviceId,
						status: 'online',
						lastSeen: now,
					};
				}

				// Create response with all known devices
				const currentDevices = api.devices.current();
				const devices: DeviceInfo[] = await Promise.all(
					Object.values(knownDevices).map(async (device) => ({
						...device,
						name: device.name ?? (await currentDevices[device.id]?.getDeviceName()),
						status: currentDeviceIds.includes(device.id) ? 'online' : 'offline',
					}))
				);

				// Sort by status (online first) then by ID
				devices.sort((a, b) => {
					if (a.status !== b.status) {
						return a.status === 'online' ? -1 : 1;
					}
					return a.id.localeCompare(b.id);
				});

				// Update the database with current status
				const updatedDevices: Record<string, DeviceInfo> = {};
				for (const device of devices) {
					updatedDevices[device.id] = device;
				}
				db.update((old) => ({
					...old,
					device_registry: updatedDevices,
				}));

				return json({ devices });
			},
			'/listWithValues': async (_req, _server, { json }) => {
				return json({ devices: await listDevicesWithValues(api, modules) });
			},
			'/occupancy/:deviceId': async (req, _server, { json }) => {
				const history = await api.occupancyTracker.getHistory(req.params.deviceId, 100);
				return json({ history });
			},
			'/button-press/:deviceId': async (req, _server, { json }) => {
				const history = await api.buttonPressTracker.getHistory(
					req.params.deviceId,
					undefined,
					100
				);
				return json({ history });
			},
			'/boolean-state/:deviceId': async (req, _server, { json }) => {
				const history = await api.booleanStateTracker.getHistory(req.params.deviceId, 100);
				return json({ history });
			},
			'/temperature/:deviceId/:timeframe': async (req, _server, { json }) => {
				const timeframe = parseInt(req.params.timeframe, 10);
				const history = await api.temperatureTracker.getHistory(
					req.params.deviceId,
					1000,
					timeframe
				);
				return json({ history });
			},
			'/humidity/:deviceId/:timeframe': async (req, _server, { json }) => {
				const timeframe = parseInt(req.params.timeframe, 10);
				const history = await api.humidityTracker.getHistory(
					req.params.deviceId,
					1000,
					timeframe
				);
				return json({ history });
			},
			'/illuminance/:deviceId/:timeframe': async (req, _server, { json }) => {
				const timeframe = parseInt(req.params.timeframe, 10);
				const history = await api.illuminanceTracker.getHistory(
					req.params.deviceId,
					1000,
					timeframe
				);
				return json({ history });
			},
			'/updateName': withRequestBody(
				z.object({
					deviceId: z.string(),
					name: z.string(),
				}),
				(body, _req, _server, { json }) => {
					const { deviceId, name } = body;

					if (api.updateDeviceName(deviceId, name)) {
						return json({ success: true });
					}

					return json({ error: 'Device not found' }, { status: 404 });
				}
			),
			'/updateRoom': withRequestBody(
				z.object({
					deviceId: z.string(),
					room: z.string().optional(),
					icon: z.string().optional(),
				}),
				(body, _req, _server, { json }) => {
					const { deviceId, room, icon } = body;

					if (api.updateDeviceRoom(deviceId, room, icon as IncludedIconNames)) {
						return json({ success: true });
					}

					return json({ error: 'Device not found' }, { status: 404 });
				}
			),
			'/rooms': (_req, _server, { json }) => {
				const rooms = api.getRooms();
				return json({ rooms });
			},
			[validateClusterRoute('/cluster/OnOff')]: withRequestBody(
				z.object({
					deviceIds: z.array(z.string()),
					isOn: z.boolean(),
				}),
				async (body, _req, _server, res) =>
					performActionForDeviceCluster(
						api,
						res,
						body.deviceIds,
						DeviceOnOffCluster,
						async (cluster) => {
							{
								const onDone = new Promise<void>((resolve) => {
									const callback = (value: boolean) => {
										if (value === body.isOn) {
											resolve();
										}
									};
									cluster.isOn.subscribe(callback);
								});
								void cluster.setOn(body.isOn);
								await onDone;
							}
						}
					)
			),
			[validateClusterRoute('/cluster/WindowCovering')]: withRequestBody(
				z.object({
					deviceIds: z.array(z.string()),
					targetPositionLiftPercentage: z.number(),
				}),
				async (body, _req, _server, res) =>
					performActionForDeviceCluster(
						api,
						res,
						body.deviceIds,
						DeviceWindowCoveringCluster,
						async (cluster) => {
							await cluster.goToLiftPercentage({
								percentage: body.targetPositionLiftPercentage,
							});
						}
					)
			),
			[validateClusterRoute('/cluster/ColorControl')]: withRequestBody(
				z.object({
					deviceIds: z.array(z.string()),
					hue: z.number().min(0).max(360),
					saturation: z.number().min(0).max(100),
					value: z.number().min(0).max(100).optional(),
				}),
				async (body, _req, _server, res) =>
					performActionForDeviceCluster(
						api,
						res,
						body.deviceIds,
						DeviceColorControlCluster,
						async (cluster) => {
							const color = Color.fromHSV(
								body.hue / 360,
								body.saturation / 100,
								(body.value ?? 100) / 100
							);
							await cluster.setColor({
								color,
							});
						}
					)
			),
			[validateClusterRoute('/cluster/LevelControl')]: withRequestBody(
				z.object({
					deviceIds: z.array(z.string()),
					level: z.number().min(0).max(100),
				}),
				async (body, _req, _server, res) =>
					performActionForDeviceCluster(
						api,
						res,
						body.deviceIds,
						DeviceLevelControlCluster,
						async (cluster) => {
							await cluster.setLevel({
								level: body.level / 100, // Convert 0-100 to 0-1
							});
						}
					)
			),
			[validateClusterRoute('/cluster/Actions')]: withRequestBody(
				z.object({
					deviceIds: z.array(z.string()),
					actionId: z.number(),
				}),
				async (body, _req, _server, res) =>
					performActionForDeviceCluster(
						api,
						res,
						body.deviceIds,
						DeviceActionsCluster,
						async (cluster) => {
							await cluster.executeAction({ actionId: body.actionId });
						}
					)
			),
			[validateClusterRoute('/cluster/Thermostat')]: withRequestBody(
				z.object({
					deviceIds: z.array(z.string()),
					targetTemperature: z.number().optional(),
					mode: z.nativeEnum(ThermostatMode).optional(),
				}),
				async (body, _req, _server, res) =>
					performActionForDeviceCluster(
						api,
						res,
						body.deviceIds,
						DeviceThermostatCluster,
						async (cluster) => {
							if (body.targetTemperature !== undefined) {
								await cluster.setTargetTemperature(body.targetTemperature);
							}
							if (body.mode !== undefined) {
								await cluster.setMode(body.mode);
							}
						}
					)
			),
			'/scenes/list': (_req, _server, { json }) => {
				const scenes = api.sceneAPI.listScenes();
				return json({ scenes });
			},
			'/scenes/create': withRequestBody(
				z.object({
					title: z.string(),
					icon: z.string() as z.ZodType<IncludedIconNames>,
					actions: z.array(
						z.union([
							z.object({
								deviceId: z.string().optional(),
								groupId: z.string().optional(),
								cluster: z.literal(DeviceClusterName.ON_OFF),
								action: z.object({
									isOn: z.boolean(),
								}),
							}),
							z.object({
								deviceId: z.string().optional(),
								groupId: z.string().optional(),
								cluster: z.literal(DeviceClusterName.WINDOW_COVERING),
								action: z.object({
									targetPositionLiftPercentage: z.number(),
								}),
							}),
							z.object({
								deviceId: z.string().optional(),
								groupId: z.string().optional(),
								cluster: z.literal(DeviceClusterName.COLOR_CONTROL),
								action: z.object({
									hue: z.number(),
									saturation: z.number(),
									value: z.number(),
								}),
							}),
							z.object({
								deviceId: z.string().optional(),
								groupId: z.string().optional(),
								cluster: z.literal(DeviceClusterName.COLOR_CONTROL),
								action: z.object({
									paletteId: z.string(),
								}),
							}),
							z.object({
								deviceId: z.string().optional(),
								groupId: z.string().optional(),
								cluster: z.literal(DeviceClusterName.LEVEL_CONTROL),
								action: z.object({
									level: z.number(),
								}),
							}),
							z.object({
								cluster: z.literal('http-request'),
								action: z.object({
									url: z.string(),
									method: z.enum(['GET', 'POST']),
									body: z.record(z.string(), z.unknown()).optional(),
									headers: z.record(z.string(), z.string()).optional(),
								}),
							}),
						])
					),
					triggers: z
						.array(
							z.object({
								trigger: z.union([
									z.object({
										type: z.literal(SceneTriggerType.OCCUPANCY),
										deviceId: z.string(),
									}),
									z.object({
										type: z.literal(SceneTriggerType.BUTTON_PRESS),
										deviceId: z.string(),
										buttonIndex: z.number(),
									}),
									z.object({
										type: z.literal(SceneTriggerType.HOST_ARRIVAL),
										hostId: z.string(),
									}),
									z.object({
										type: z.literal(SceneTriggerType.HOST_DEPARTURE),
										hostId: z.string(),
									}),
									z.object({
										type: z.literal(SceneTriggerType.WEBHOOK),
										webhookName: z.string(),
									}),
									z.object({
										type: z.literal(SceneTriggerType.ANYBODY_HOME),
									}),
									z.object({
										type: z.literal(SceneTriggerType.NOBODY_HOME),
									}),
									z.object({
										type: z.literal(SceneTriggerType.NOBODY_HOME_TIMEOUT),
									}),
								]),
								conditions: z
									.array(
										z.union([
											z.object({
												type: z.literal(SceneConditionType.HOST_HOME),
												hostId: z.string(),
												shouldBeHome: z.boolean(),
											}),
											z.object({
												type: z.literal(SceneConditionType.DEVICE_ON),
												deviceId: z.string(),
												shouldBeOn: z.boolean(),
											}),
											z.object({
												type: z.literal(SceneConditionType.TIME_WINDOW),
												windows: z.object({
													monday: z
														.object({
															start: z.string(),
															end: z.string(),
														})
														.optional(),
													tuesday: z
														.object({
															start: z.string(),
															end: z.string(),
														})
														.optional(),
													wednesday: z
														.object({
															start: z.string(),
															end: z.string(),
														})
														.optional(),
													thursday: z
														.object({
															start: z.string(),
															end: z.string(),
														})
														.optional(),
													friday: z
														.object({
															start: z.string(),
															end: z.string(),
														})
														.optional(),
													saturday: z
														.object({
															start: z.string(),
															end: z.string(),
														})
														.optional(),
													sunday: z
														.object({
															start: z.string(),
															end: z.string(),
														})
														.optional(),
												}),
											}),
											z.object({
												type: z.literal(SceneConditionType.ANYONE_HOME),
												shouldBeHome: z.boolean(),
											}),
										])
									)
									.optional(),
							})
						)
						.optional(),
					showOnHome: z.boolean().optional(),
				}),
				(body, _req, _server, { json }) => {
					const sceneId = api.sceneAPI.createScene(body);
					return json({ success: true, sceneId });
				}
			),
			'/scenes/:sceneId/update': withRequestBody(
				z.object({
					title: z.string(),
					icon: z.string() as z.ZodType<IncludedIconNames>,
					actions: z.array(
						z.union([
							z.object({
								deviceId: z.string().optional(),
								groupId: z.string().optional(),
								cluster: z.literal(DeviceClusterName.ON_OFF),
								action: z.object({
									isOn: z.boolean(),
								}),
							}),
							z.object({
								deviceId: z.string().optional(),
								groupId: z.string().optional(),
								cluster: z.literal(DeviceClusterName.WINDOW_COVERING),
								action: z.object({
									targetPositionLiftPercentage: z.number(),
								}),
							}),
							z.object({
								deviceId: z.string().optional(),
								groupId: z.string().optional(),
								cluster: z.literal(DeviceClusterName.COLOR_CONTROL),
								action: z.object({
									hue: z.number(),
									saturation: z.number(),
									value: z.number(),
								}),
							}),
							z.object({
								deviceId: z.string().optional(),
								groupId: z.string().optional(),
								cluster: z.literal(DeviceClusterName.COLOR_CONTROL),
								action: z.object({
									paletteId: z.string(),
								}),
							}),
							z.object({
								deviceId: z.string().optional(),
								groupId: z.string().optional(),
								cluster: z.literal(DeviceClusterName.LEVEL_CONTROL),
								action: z.object({
									level: z.number(),
								}),
							}),
							z.object({
								deviceId: z.string().optional(),
								groupId: z.string().optional(),
								cluster: z.literal('http-request'),
								action: z.object({
									url: z.string(),
									method: z.enum(['GET', 'POST']),
									body: z.record(z.string(), z.unknown()).optional(),
									headers: z.record(z.string(), z.string()).optional(),
								}),
							}),
						])
					),
					triggers: z
						.array(
							z.object({
								trigger: z.union([
									z.object({
										type: z.literal(SceneTriggerType.OCCUPANCY),
										deviceId: z.string(),
									}),
									z.object({
										type: z.literal(SceneTriggerType.BUTTON_PRESS),
										deviceId: z.string(),
										buttonIndex: z.number(),
									}),
									z.object({
										type: z.literal(SceneTriggerType.HOST_ARRIVAL),
										hostId: z.string(),
									}),
									z.object({
										type: z.literal(SceneTriggerType.HOST_DEPARTURE),
										hostId: z.string(),
									}),
									z.object({
										type: z.literal(SceneTriggerType.WEBHOOK),
										webhookName: z.string(),
									}),
									z.object({
										type: z.literal(SceneTriggerType.ANYBODY_HOME),
									}),
									z.object({
										type: z.literal(SceneTriggerType.NOBODY_HOME),
									}),
									z.object({
										type: z.literal(SceneTriggerType.NOBODY_HOME_TIMEOUT),
									}),
								]),
								conditions: z
									.array(
										z.union([
											z.object({
												type: z.literal(SceneConditionType.HOST_HOME),
												hostId: z.string(),
												shouldBeHome: z.boolean(),
											}),
											z.object({
												type: z.literal(SceneConditionType.DEVICE_ON),
												deviceId: z.string(),
												shouldBeOn: z.boolean(),
											}),
											z.object({
												type: z.literal(SceneConditionType.TIME_WINDOW),
												windows: z.object({
													monday: z
														.object({
															start: z.string(),
															end: z.string(),
														})
														.optional(),
													tuesday: z
														.object({
															start: z.string(),
															end: z.string(),
														})
														.optional(),
													wednesday: z
														.object({
															start: z.string(),
															end: z.string(),
														})
														.optional(),
													thursday: z
														.object({
															start: z.string(),
															end: z.string(),
														})
														.optional(),
													friday: z
														.object({
															start: z.string(),
															end: z.string(),
														})
														.optional(),
													saturday: z
														.object({
															start: z.string(),
															end: z.string(),
														})
														.optional(),
													sunday: z
														.object({
															start: z.string(),
															end: z.string(),
														})
														.optional(),
												}),
											}),
											z.object({
												type: z.literal(SceneConditionType.ANYONE_HOME),
												shouldBeHome: z.boolean(),
											}),
										])
									)
									.optional(),
							})
						)
						.optional(),
					showOnHome: z.boolean().optional(),
				}),
				(body, req, _server, { json }) => {
					const success = api.sceneAPI.updateScene(req.params.sceneId, body);
					if (!success) {
						return json({ error: 'Scene not found' }, { status: 404 });
					}
					return json({ success: true });
				}
			),
			'/scenes/:sceneId/delete': (req, _server, { json }) => {
				const success = api.sceneAPI.deleteScene(req.params.sceneId);
				if (!success) {
					return json({ error: 'Scene not found' }, { status: 404 });
				}
				return json({ success: true });
			},
			'/scenes/:sceneId/trigger': async (req, _server, { json }) => {
				const success = await api.sceneAPI.triggerScene(req.params.sceneId);
				if (!success) {
					return json({ error: 'Scene not found or execution failed' }, { status: 404 });
				}
				return json({ success: true });
			},
			'/groups/list': (_req, _server, { json }) => {
				const groups = api.groupAPI.listGroups();
				return json({ groups });
			},
			'/groups/create': withRequestBody(
				z.object({
					name: z.string(),
					deviceIds: z.array(z.string()),
					icon: z.string().optional(),
					showOnHome: z.boolean().optional(),
				}),
				(body, _req, _server, { json }) => {
					try {
						const groupId = api.groupAPI.createGroup(body as Omit<DeviceGroup, 'id'>);
						return json({ success: true, groupId });
					} catch (error) {
						return json(
							{
								error:
									error instanceof Error
										? error.message
										: 'Failed to create group',
							},
							{ status: 400 }
						);
					}
				}
			),
			'/groups/:groupId/update': withRequestBody(
				z.object({
					name: z.string(),
					deviceIds: z.array(z.string()),
					icon: z.string().optional(),
					showOnHome: z.boolean().optional(),
				}),
				(body, req, _server, { json }) => {
					try {
						const success = api.groupAPI.updateGroup(
							req.params.groupId,
							body as Omit<DeviceGroup, 'id'>
						);
						if (!success) {
							return json({ error: 'Group not found' }, { status: 404 });
						}
						return json({ success: true });
					} catch (error) {
						return json(
							{
								error:
									error instanceof Error
										? error.message
										: 'Failed to update group',
							},
							{ status: 400 }
						);
					}
				}
			),
			'/groups/:groupId/delete': (req, _server, { json }) => {
				const success = api.groupAPI.deleteGroup(req.params.groupId);
				if (!success) {
					return json({ error: 'Group not found' }, { status: 404 });
				}
				return json({ success: true });
			},
			'/palettes/list': (_req, _server, { json }) => {
				const palettes = api.paletteAPI.listPalettes();
				return json({ palettes });
			},
			'/palettes/create': withRequestBody(
				z.object({
					name: z.string(),
					colors: z.array(z.string()),
				}),
				(body, _req, _server, { json }) => {
					try {
						const paletteId = api.paletteAPI.createPalette(body);
						return json({ success: true, paletteId });
					} catch (error) {
						return json(
							{
								error:
									error instanceof Error
										? error.message
										: 'Failed to create palette',
							},
							{ status: 400 }
						);
					}
				}
			),
			'/palettes/:paletteId/update': withRequestBody(
				z.object({
					name: z.string(),
					colors: z.array(z.string()),
				}),
				(body, req, _server, { json }) => {
					try {
						const success = api.paletteAPI.updatePalette(req.params.paletteId, body);
						if (!success) {
							return json({ error: 'Palette not found' }, { status: 404 });
						}
						return json({ success: true });
					} catch (error) {
						return json(
							{
								error:
									error instanceof Error
										? error.message
										: 'Failed to update palette',
							},
							{ status: 400 }
						);
					}
				}
			),
			'/palettes/:paletteId/delete': (req, _server, { json }) => {
				const success = api.paletteAPI.deletePalette(req.params.paletteId);
				if (!success) {
					return json({ error: 'Palette not found' }, { status: 404 });
				}
				return json({ success: true });
			},
			'/palettes/:paletteId/apply': withRequestBody(
				z.object({
					deviceIds: z.array(z.string()),
				}),
				async (body, req, _server, { json }) => {
					const palette = api.paletteAPI.getPalette(req.params.paletteId);
					if (!palette) {
						return json({ error: 'Palette not found' }, { status: 404 });
					}

					// Get devices
					const devices = body.deviceIds
						.map((id) => api.devices.current()[id])
						.filter((d) => d !== undefined);

					if (devices.length === 0) {
						return json({ error: 'No devices found' }, { status: 404 });
					}

					const success = await applyPaletteToDevices(devices, palette);
					if (!success) {
						return json(
							{ error: 'Failed to apply palette to all devices' },
							{ status: 500 }
						);
					}

					return json({ success: true });
				}
			),
		},
		true,
		{
			// TODO: type this
			open: async (ws) => {
				ws.send(
					JSON.stringify({
						type: 'devices',
						devices: await listDevicesWithValues(api, modules),
					} satisfies DeviceWebsocketServerMessage)
				);
			},
			message: async (ws, message) => {
				const parsedMessage = JSON.parse(
					message.toString()
				) as DeviceWebsocketClientMessage;
				if (parsedMessage.type === 'refreshDevices') {
					ws.send(
						JSON.stringify({
							type: 'devices',
							devices: await listDevicesWithValues(api, modules),
						} satisfies DeviceWebsocketServerMessage)
					);
				}
			},
		}
	);
}

export type DeviceWebsocketServerMessage = {
	type: 'devices';
	devices: DeviceListWithValuesResponse;
};

export type DeviceWebsocketClientMessage = {
	type: 'refreshDevices';
};

const getClusterState = async (
	api: DeviceAPI,
	_cluster: Cluster,
	deviceId: string
): Promise<DashboardDeviceClusterWithState> => {
	const clusterName = _cluster.getName();
	if (clusterName === DeviceClusterName.ON_OFF) {
		const cluster = _cluster as DeviceOnOffCluster;
		const isOn = await cluster.isOn.get();
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName),
			isOn: isOn ?? false,
		};
	}
	if (clusterName === DeviceClusterName.WINDOW_COVERING) {
		const cluster = _cluster as DeviceWindowCoveringCluster;
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName),
			targetPositionLiftPercentage: (await cluster.targetPositionLiftPercentage.get()) ?? 0,
		};
	}
	if (clusterName === DeviceClusterName.POWER_SOURCE) {
		const cluster = _cluster as DevicePowerSourceCluster;
		const batteryLevel = await cluster.batteryChargeLevel.get();
		if (batteryLevel !== null) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName),
				batteryPercentage: batteryLevel,
			};
		}
	}
	if (clusterName === DeviceClusterName.OCCUPANCY_SENSING) {
		const cluster = _cluster as DeviceOccupancySensingCluster;
		const occupied = await cluster.occupancy.get();
		const lastEvent = await api.occupancyTracker.getLastTriggered(deviceId);
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName),
			occupied: occupied ?? false,
			lastTriggered: lastEvent?.timestamp,
		};
	}
	if (clusterName === DeviceClusterName.TEMPERATURE_MEASUREMENT) {
		const cluster = _cluster as DeviceTemperatureMeasurementCluster;
		const temperature = await cluster.temperature.get();
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName),
			temperature: temperature ?? 20.0,
		};
	}
	if (clusterName === DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT) {
		const cluster = _cluster as DeviceRelativeHumidityMeasurementCluster;
		const humidity = await cluster.relativeHumidity.get();
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName),
			humidity: humidity ?? 50.0,
		};
	}
	if (clusterName === DeviceClusterName.ILLUMINANCE_MEASUREMENT) {
		const cluster = _cluster as DeviceIlluminanceMeasurementCluster;
		const illuminance = await cluster.illuminance.get();
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName),
			illuminance,
		};
	}
	if (clusterName === DeviceClusterName.BOOLEAN_STATE) {
		const cluster = _cluster as DeviceBooleanStateCluster<boolean>;
		const state = await cluster.state.get();
		const lastEvent = await api.booleanStateTracker.getLastChanged(deviceId);
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName),
			state: state ?? false,
			lastChanged: lastEvent?.timestamp,
		};
	}
	if (clusterName === DeviceClusterName.SWITCH) {
		const cluster = _cluster as DeviceSwitchCluster;
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName),
			label: cluster.getLabel(),
			index: cluster.getIndex(),
			totalCount: cluster.getTotalCount(),
		};
	}
	if (clusterName === DeviceClusterName.COLOR_CONTROL) {
		const cluster = _cluster as DeviceColorControlCluster;
		const color = (await cluster.color.get()) ?? new Color(0, 0, 0);
		const hsv = color.toHSV();
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName),
			color: hsv,
			mergedClusters: {},
		};
	}
	if (clusterName === DeviceClusterName.LEVEL_CONTROL) {
		const cluster = _cluster as DeviceLevelControlCluster;
		const level = await cluster.currentLevel.get();
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName),
			currentLevel: level * 100, // Convert 0-1 to 0-100
		};
	}
	if (clusterName === DeviceClusterName.ACTIONS) {
		const cluster = _cluster as DeviceActionsCluster;
		const actionList = await cluster.actionList.get();
		const activeAction = actionList.find((a) => a.state === Actions.ActionState.Active);
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName),
			actions: actionList,
			activeActionId: activeAction?.id,
		};
	}
	if (clusterName === DeviceClusterName.THERMOSTAT) {
		const cluster = _cluster as DeviceThermostatCluster;
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName),
			currentTemperature: (await cluster.currentTemperature.get()) ?? 20.0,
			targetTemperature: (await cluster.targetTemperature.get()) ?? 20.0,
			mode: (await cluster.mode.get()) ?? ThermostatMode.OFF,
			isHeating: await cluster.isHeating.get(),
			minTemperature: 5.0,
			maxTemperature: 30.0,
		};
	}
	return {
		name: clusterName,
		icon: getClusterIconName(clusterName),
	} as DashboardDeviceClusterWithState;
};

async function listDevicesWithValues(api: DeviceAPI, modules: AllModules) {
	const deviceApi = await modules.device.api.value;
	const devices = [...Object.values(await deviceApi.devices.get())];
	const storedDevices = deviceApi.getStoredDevices();
	const rooms = deviceApi.getRooms();
	const responseDevices: DashboardDeviceResponse[] = [];

	const _getClusterState = async (cluster: Cluster, deviceId: string) => {
		if (!clusterStateCache.has(cluster)) {
			const clusterState = await getClusterState(api, cluster, deviceId);
			clusterStateCache.set(cluster, clusterState);
		}
		return clusterStateCache.get(cluster)!;
	};

	const clusterStateCache = new WeakMap<Cluster, DashboardDeviceClusterWithState>();
	const getResponseForEndpoint = async (
		endpoint: DeviceEndpoint,
		deviceId: string
	): Promise<DashboardDeviceEndpointResponse> => {
		const endpoints = [];
		const clusters = [];
		const allClusters = [];

		// Get all cluster states
		for (const cluster of endpoint.clusters) {
			clusters.push(await _getClusterState(cluster, deviceId));
		}

		for (const { cluster, endpoint: clusterEndpoint } of endpoint.allClusters) {
			allClusters.push({
				cluster: await _getClusterState(cluster, deviceId),
				endpoint: clusterEndpoint,
			});
		}

		const mergeEndpointClusters = (
			clusterList: {
				cluster: DashboardDeviceClusterWithState;
				endpoint: DeviceEndpoint;
			}[]
		) => {
			const clustersForEndpoints = new Map<
				DeviceEndpoint,
				DashboardDeviceClusterWithStateMap
			>();
			for (const { cluster, endpoint } of clusterList) {
				const clusterMap = clustersForEndpoints.get(endpoint) ?? {};
				// @ts-ignore
				clusterMap[cluster.name] = cluster;
				clustersForEndpoints.set(endpoint, clusterMap);
			}

			const mergedClusters: DashboardDeviceClusterWithState[] = [];
			for (const clusters of clustersForEndpoints.values()) {
				// Merge ColorControl with OnOff, LevelControl, and Actions clusters
				if (clusters[DeviceClusterName.COLOR_CONTROL]) {
					mergedClusters.push({
						name: DeviceClusterName.COLOR_CONTROL,
						icon: getClusterIconName(DeviceClusterName.COLOR_CONTROL),
						color: {
							hue: clusters[DeviceClusterName.COLOR_CONTROL].color.hue,
							saturation: clusters[DeviceClusterName.COLOR_CONTROL].color.saturation,
							value: clusters[DeviceClusterName.COLOR_CONTROL].color.value,
						},
						mergedClusters: {
							[DeviceClusterName.ON_OFF]: clusters[DeviceClusterName.ON_OFF],
							[DeviceClusterName.LEVEL_CONTROL]:
								clusters[DeviceClusterName.LEVEL_CONTROL],
							[DeviceClusterName.ACTIONS]: clusters[DeviceClusterName.ACTIONS],
						},
					});
					// Remove merged clusters so they don't appear separately
					delete clusters[DeviceClusterName.ON_OFF];
					delete clusters[DeviceClusterName.LEVEL_CONTROL];
					delete clusters[DeviceClusterName.ACTIONS];
					delete clusters[DeviceClusterName.COLOR_CONTROL];
				}

				// Merge sensor clusters (OccupancySensing, TemperatureMeasurement, RelativeHumidityMeasurement, IlluminanceMeasurement)
				const hasSensor =
					clusters[DeviceClusterName.OCCUPANCY_SENSING] ||
					clusters[DeviceClusterName.TEMPERATURE_MEASUREMENT] ||
					clusters[DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT] ||
					clusters[DeviceClusterName.ILLUMINANCE_MEASUREMENT];

				if (hasSensor) {
					// Use occupancy icon if present, otherwise temperature icon as primary
					const primaryIcon = clusters[DeviceClusterName.OCCUPANCY_SENSING]
						? getClusterIconName(DeviceClusterName.OCCUPANCY_SENSING)
						: clusters[DeviceClusterName.TEMPERATURE_MEASUREMENT]
							? getClusterIconName(DeviceClusterName.TEMPERATURE_MEASUREMENT)
							: getClusterIconName(DeviceClusterName.ILLUMINANCE_MEASUREMENT);

					mergedClusters.push({
						name: DeviceClusterName.OCCUPANCY_SENSING,
						icon: primaryIcon,
						mergedClusters: {
							[DeviceClusterName.OCCUPANCY_SENSING]:
								clusters[DeviceClusterName.OCCUPANCY_SENSING],
							[DeviceClusterName.TEMPERATURE_MEASUREMENT]:
								clusters[DeviceClusterName.TEMPERATURE_MEASUREMENT],
							[DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT]:
								clusters[DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT],
							[DeviceClusterName.ILLUMINANCE_MEASUREMENT]:
								clusters[DeviceClusterName.ILLUMINANCE_MEASUREMENT],
						},
					} as DashboardDeviceClusterSensorGroup);
					// Remove merged clusters so they don't appear separately
					delete clusters[DeviceClusterName.OCCUPANCY_SENSING];
					delete clusters[DeviceClusterName.TEMPERATURE_MEASUREMENT];
					delete clusters[DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT];
					delete clusters[DeviceClusterName.ILLUMINANCE_MEASUREMENT];
				}

				// Add remaining non-merged clusters
				mergedClusters.push(...Object.values(clusters));
			}
			return mergedClusters;
		};

		// Apply merging to both cluster lists
		const mergedClusters = mergeEndpointClusters(
			clusters.map((c) => ({
				cluster: c,
				endpoint: endpoint,
			}))
		);
		let mergedAllClusters = mergeEndpointClusters(allClusters);

		for (const subEndpoint of endpoint.endpoints) {
			const endpointResponse = await getResponseForEndpoint(subEndpoint, deviceId);
			endpoints.push(endpointResponse);
		}

		// Post-process to merge multiple sensor groups into one
		const sensorGroups: DashboardDeviceClusterSensorGroup[] = [];
		const otherClusters: DashboardDeviceClusterWithState[] = [];

		for (const cluster of mergedAllClusters) {
			if (
				cluster.name === DeviceClusterName.OCCUPANCY_SENSING &&
				'mergedClusters' in cluster
			) {
				sensorGroups.push(cluster as DashboardDeviceClusterSensorGroup);
			} else {
				otherClusters.push(cluster);
			}
		}

		// If we have multiple sensor groups, merge them into one
		if (sensorGroups.length > 1) {
			const mergedSensorGroup: DashboardDeviceClusterSensorGroup = {
				name: DeviceClusterName.OCCUPANCY_SENSING,
				icon: getClusterIconName(DeviceClusterName.OCCUPANCY_SENSING),
				mergedClusters: {
					[DeviceClusterName.OCCUPANCY_SENSING]: undefined,
					[DeviceClusterName.TEMPERATURE_MEASUREMENT]: undefined,
					[DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT]: undefined,
					[DeviceClusterName.ILLUMINANCE_MEASUREMENT]: undefined,
				},
			};

			// Merge all sensor data from different groups
			for (const group of sensorGroups) {
				if (group.mergedClusters[DeviceClusterName.OCCUPANCY_SENSING]) {
					mergedSensorGroup.mergedClusters[DeviceClusterName.OCCUPANCY_SENSING] =
						group.mergedClusters[DeviceClusterName.OCCUPANCY_SENSING];
				}
				if (group.mergedClusters[DeviceClusterName.TEMPERATURE_MEASUREMENT]) {
					mergedSensorGroup.mergedClusters[DeviceClusterName.TEMPERATURE_MEASUREMENT] =
						group.mergedClusters[DeviceClusterName.TEMPERATURE_MEASUREMENT];
				}
				if (group.mergedClusters[DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT]) {
					mergedSensorGroup.mergedClusters[
						DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT
					] = group.mergedClusters[DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT];
				}
				if (group.mergedClusters[DeviceClusterName.ILLUMINANCE_MEASUREMENT]) {
					mergedSensorGroup.mergedClusters[DeviceClusterName.ILLUMINANCE_MEASUREMENT] =
						group.mergedClusters[DeviceClusterName.ILLUMINANCE_MEASUREMENT];
				}
			}

			mergedAllClusters = [...otherClusters, mergedSensorGroup];
		}

		return {
			name: await endpoint.getDeviceName(),
			childClusters: mergedClusters,
			endpoints,
			mergedAllClusters: mergedAllClusters,
			flatAllClusters: allClusters.map((c) => c.cluster),
		};
	};

	await Promise.all(
		devices.map(async (device) => {
			const deviceId = device.getUniqueId();
			const storedDevice = storedDevices[deviceId];
			const room = storedDevice?.room;
			const roomInfo = room ? rooms[room] : undefined;

			const endpointResponse = await getResponseForEndpoint(device, deviceId);

			const responseDevice: DashboardDeviceResponse = {
				uniqueId: deviceId,
				source: {
					name: device.getSource().value,
					emoji: device.getSource().toEmoji(),
				},
				room: room,
				roomColor: roomInfo?.color,
				roomIcon: roomInfo?.icon,
				...endpointResponse,
				name: storedDevice?.name ?? endpointResponse.name,
				managementUrl: await device.getManagementUrl(),
			};
			responseDevices.push(responseDevice);
		})
	);

	return responseDevices;
}

export type DeviceListWithValuesResponse = Awaited<ReturnType<typeof listDevicesWithValues>>;

function getClusterIconName(clusterName: DeviceClusterName): IncludedIconNames | undefined {
	switch (clusterName) {
		case DeviceClusterName.ON_OFF:
			return 'Lightbulb';
		case DeviceClusterName.WINDOW_COVERING:
			return 'Window';
		case DeviceClusterName.LEVEL_CONTROL:
			return 'Tune';
		case DeviceClusterName.POWER_SOURCE:
			return 'BatteryChargingFull';
		case DeviceClusterName.GROUPS:
			return 'Group';
		case DeviceClusterName.OCCUPANCY_SENSING:
			return 'Sensors';
		case DeviceClusterName.TEMPERATURE_MEASUREMENT:
			return 'DeviceThermostat';
		case DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT:
			return 'WaterDrop';
		case DeviceClusterName.BOOLEAN_STATE:
			return 'ToggleOn';
		case DeviceClusterName.SWITCH:
			return 'ToggleOff';
		case DeviceClusterName.ILLUMINANCE_MEASUREMENT:
			return 'LightMode';
		case DeviceClusterName.COLOR_CONTROL:
			return 'Palette';
		case DeviceClusterName.THERMOSTAT:
			return 'DeviceThermostat';
		default:
			return undefined;
	}
}

async function performActionForDeviceCluster<
	C extends typeof Cluster & {
		clusterName: DeviceClusterName;
	},
>(
	api: DeviceAPI,
	res: BrandedRouteHandlerResponse,
	deviceIds: string[],
	clusterType: C,
	callback: (cluster: InstanceType<C>) => Promise<void>
) {
	const devices = deviceIds.map((id) => api.devices.current()[id]);
	if (devices.some((d) => !d)) {
		return res.error({ error: 'Device not found' }, 404);
	}
	const clusters = devices.flatMap((d) => d.getAllClustersByType(clusterType));
	if (clusters.some((c) => !c)) {
		return res.error({ error: 'Cluster not found' }, 404);
	}
	try {
		const success = await Promise.race([
			Promise.all(clusters.map((c) => callback(c))).then(() => true),
			wait(10000).then(() => false),
		]);
		if (!success) {
			return res.error({ error: 'Cluster operation timed out' }, 500);
		}
		return res.json({ success: true });
	} catch (error) {
		logTag('device', 'red', 'Cluster operation error:', error);
		return res.error({ error: 'Cluster operation failed', details: String(error) }, 500);
	}
}

function validateClusterRoute<T extends `/cluster/${DeviceClusterName}`>(route: T): T {
	return route;
}

export const initRouting = _initRouting as (
	config: ModuleConfig,
	api: DeviceAPI
) => ServeOptions<unknown>;

export type DeviceRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
