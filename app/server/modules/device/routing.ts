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
	DeviceElectricalEnergyMeasurementCluster,
	DeviceElectricalPowerMeasurementCluster,
	DeviceCarbonDioxideConcentrationMeasurementWithNumericAndLevelIndicationCluster,
	DeviceAirQualityCluster,
	DevicePm25ConcentrationMeasurementWithNumericAndLevelIndicationCluster,
	DeviceWasherCluster,
	DeviceFridgeCluster,
	DeviceThreeDPrinterCluster,
} from './cluster';
import {
	DeviceOnOffCluster,
	DeviceClusterName,
	DeviceWindowCoveringCluster,
	DeviceLevelControlCluster,
	DeviceActionsCluster,
	DeviceThermostatCluster,
	ThermostatMode,
	DeviceColorControlXYCluster,
	DeviceColorControlTemperatureCluster,
	DeviceDoorLockCluster,
	LockState,
} from './cluster';
import { createDeduplicatedTypedWSPublish } from '../../lib/deduplicated-ws-publish';
import type { IncludedIconNames } from '../../../client/dashboard/components/icon';
import type { BrandedRouteHandlerResponse, ServeOptions } from '../../lib/routes';
import { SceneTriggerType, SceneConditionType } from '../../../../types/scene';
import { createServeOptions, withRequestBody } from '../../lib/routes';
import type { DeviceGroup } from '../../../../types/group';
import { applyPaletteToDevices } from './palette-executor';
import type { Device, DeviceEndpoint } from './device';
import type { PrintState } from '../bambulab/types';
import type { AllModules, ModuleConfig } from '..';
import { logTag } from '../../lib/logging/logger';
import { Actions } from '@matter/main/clusters';
import type { ClassEnum } from '../../lib/enum';
import type { Database } from '../../lib/db';
import { Color } from '../../lib/color';
import { DeviceSource } from './device';
import type { DeviceAPI } from './api';
import { wait } from '../../lib/time';
import type { HouseLayout } from '.';
import * as z from 'zod';

export interface DeviceInfo {
	id: string;
	status: 'online' | 'offline' | 'unknown';
	lastSeen: number; // timestamp
	name?: string;
	room?: string;
	position?: { x: number; y: number };
	clusterNames?: DeviceClusterName[];
	source?: string; // DeviceSource value as string
	customIcon?: IncludedIconNames;
}

export interface RoomInfo {
	name: string;
	color: string; // Pastel color based on name hash
	icon?: IncludedIconNames;
	polygon?: Array<{ x: number; y: number }>;
}

type DashboardDeviceClusterBase = {
	name: DeviceClusterName;
	icon?: IncludedIconNames;
};

export type DashboardDeviceClusterOnOff = DashboardDeviceClusterBase & {
	name: DeviceClusterName.ON_OFF;
	isOn: boolean;
	mergedClusters?: {
		[DeviceClusterName.ELECTRICAL_ENERGY_MEASUREMENT]?: DashboardDeviceClusterElectricalEnergyMeasurement;
		[DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT]?: DashboardDeviceClusterElectricalPowerMeasurement;
		[DeviceClusterName.COLOR_CONTROL]?: DashboardDeviceClusterColorControlTemperature;
		[DeviceClusterName.LEVEL_CONTROL]?: DashboardDeviceClusterLevelControl;
	};
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
	currentLevel: number; // 0-1
	levelName: string;
	step: number;
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

export type DashboardDeviceClusterColorControlXY = DashboardDeviceClusterBase & {
	name: DeviceClusterName.COLOR_CONTROL;
	clusterVariant: 'xy';
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

export type DashboardDeviceClusterColorControlTemperature = DashboardDeviceClusterBase & {
	name: DeviceClusterName.COLOR_CONTROL;
	clusterVariant: 'temperature';
	colorTemperature: number | undefined;
	minColorTemperature: number | undefined;
	maxColorTemperature: number | undefined;
};

export type DashboardDeviceClusterThreeDPrinter = DashboardDeviceClusterBase & {
	name: DeviceClusterName.THREE_D_PRINTER;
	printState: PrintState | undefined;
	bedTemperature: number | undefined;
	nozzleTemperature: number | undefined;
	bedTargetTemperature: number | undefined;
	nozzleTargetTemperature: number | undefined;
	currentLayer: number | undefined;
	totalLayers: number | undefined;
	remainingTimeMinutes: number | undefined;
	progress: number | undefined;
	currentFile: string | undefined;
	usedTray: number | undefined;
	videoStreamUrl: string | undefined;
	ams:
		| {
				temp: number;
				humidity: number;
				trays: (
					| {
							empty: true;
					  }
					| {
							empty: false;
							color: string;
							type: string;
							remaining: number;
					  }
				)[];
		  }
		| undefined;
};

export type DashboardDeviceClusterOccupancySensorGroup = DashboardDeviceClusterBase & {
	name: DeviceClusterName.OCCUPANCY_SENSING;
	mergedClusters: {
		[DeviceClusterName.OCCUPANCY_SENSING]?: DashboardDeviceClusterOccupancySensing;
		[DeviceClusterName.TEMPERATURE_MEASUREMENT]?: DashboardDeviceClusterTemperatureMeasurement;
		[DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT]?: DashboardDeviceClusterRelativeHumidityMeasurement;
		[DeviceClusterName.ILLUMINANCE_MEASUREMENT]?: DashboardDeviceClusterIlluminanceMeasurement;
	};
};

export type DashboardDeviceClusterFridge = DashboardDeviceClusterBase & {
	name: DeviceClusterName.FRIDGE;
	freezerDoorOpen: boolean;
	coolerDoorOpen: boolean;
	fridgeTempC: number | undefined;
	freezerTempC: number | undefined;
};

export type DashboardDeviceClusterWasher = DashboardDeviceClusterBase & {
	name: DeviceClusterName.WASHER;
	machineState: 'stop' | 'run' | 'pause' | undefined;
	operatingState: 'ready' | 'running' | 'paused' | undefined;
	washerJobState: 'none' | string | undefined;
	done: boolean | undefined;
	completionTime: string | undefined;
	remainingTimeMinutes: number | undefined;
	remainingTimeStr: string | undefined;
	detergentRemainingCc: number | undefined;
	detergentInitialCc: number | undefined;
	softenerRemainingCc: number | undefined;
	softenerInitialCc: number | undefined;
	cycle: string | undefined;
	cycleType: 'washingOnly' | undefined;
	phase: 'wash' | 'rinse' | 'spin' | 'none' | undefined;
	progressPercent: number | undefined;
	scheduledPhases: Array<{ phaseName: string; timeInMin: number }> | undefined;
};

export type DashboardDeviceClusterDoorLock = DashboardDeviceClusterBase & {
	name: DeviceClusterName.DOOR_LOCK;
	/** LockState enum: NotFullyLocked=0, Locked=1, Unlocked=2, Unlatched=3 */
	lockState: number;
};

/** @deprecated Use DashboardDeviceClusterOccupancySensorGroup instead */
export type DashboardDeviceClusterSensorGroup = DashboardDeviceClusterOccupancySensorGroup;

export type DashboardDeviceClusterThermostat = DashboardDeviceClusterBase & {
	name: DeviceClusterName.THERMOSTAT;
	currentTemperature: number;
	targetTemperature: number;
	mode: ThermostatMode;
	isHeating: boolean;
	minTemperature: number;
	maxTemperature: number;
};

export type DashboardDeviceClusterElectricalEnergyMeasurement = DashboardDeviceClusterBase & {
	name: DeviceClusterName.ELECTRICAL_ENERGY_MEASUREMENT;
	totalEnergy: string; // kWh formatted
	period?: {
		from: Date;
		to: Date;
	};
};

export type DashboardDeviceClusterElectricalPowerMeasurement = DashboardDeviceClusterBase & {
	name: DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT;
	activePower: number; // Watts
};

/**
 * CO2 Level values from Matter spec
 * Unknown = 0, Low = 1, Medium = 2, High = 3, Critical = 4
 */
export type CO2LevelValue = 0 | 1 | 2 | 3 | 4;

export type DashboardDeviceClusterCO2ConcentrationMeasurement = DashboardDeviceClusterBase & {
	name: DeviceClusterName.CARBON_DIOXIDE_CONCENTRATION_MEASUREMENT;
	clusterVariant: 'numeric+levelIndication';
	/** CO2 concentration in parts per million */
	concentration: number | undefined;
	/** Level indicator: Unknown=0, Low=1, Medium=2, High=3, Critical=4 */
	level: CO2LevelValue;
};

/**
 * AirQuality enum values from Matter spec
 * Unknown=0, Good=1, Fair=2, Moderate=3, Poor=4, VeryPoor=5, ExtremelyPoor=6
 */
export type AirQualityValue = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type DashboardDeviceClusterAirQuality = DashboardDeviceClusterBase & {
	name: DeviceClusterName.AIR_QUALITY;
	airQuality: AirQualityValue;
};

export type DashboardDeviceClusterPM25ConcentrationMeasurement = DashboardDeviceClusterBase & {
	name: DeviceClusterName.PM_2_5_CONCENTRATION_MEASUREMENT;
	clusterVariant: 'numeric+levelIndication';
	/** PM2.5 concentration in micrograms per cubic meter */
	concentration: number | undefined;
	/** Level indicator: Unknown=0, Low=1, Medium=2, High=3, Critical=4 */
	level: CO2LevelValue;
};

export type DashboardDeviceClusterAirQualityGroup = DashboardDeviceClusterBase & {
	name: DeviceClusterName.AIR_QUALITY;
	mergedClusters: {
		[DeviceClusterName.AIR_QUALITY]?: DashboardDeviceClusterAirQuality;
		[DeviceClusterName.CARBON_DIOXIDE_CONCENTRATION_MEASUREMENT]?: DashboardDeviceClusterCO2ConcentrationMeasurement;
		[DeviceClusterName.PM_2_5_CONCENTRATION_MEASUREMENT]?: DashboardDeviceClusterPM25ConcentrationMeasurement;
		[DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT]?: DashboardDeviceClusterRelativeHumidityMeasurement;
		[DeviceClusterName.ILLUMINANCE_MEASUREMENT]?: DashboardDeviceClusterIlluminanceMeasurement;
		[DeviceClusterName.ON_OFF]?: DashboardDeviceClusterOnOff;
		[DeviceClusterName.TEMPERATURE_MEASUREMENT]?: DashboardDeviceClusterTemperatureMeasurement;
	};
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
		| DashboardDeviceClusterColorControlXY
		| DashboardDeviceClusterColorControlTemperature
		| DashboardDeviceClusterActions
		| DashboardDeviceClusterThermostat
		| DashboardDeviceClusterFridge
		| DashboardDeviceClusterThreeDPrinter
		| DashboardDeviceClusterWasher
		| DashboardDeviceClusterDoorLock
		| DashboardDeviceClusterOccupancySensorGroup
		| DashboardDeviceClusterElectricalEnergyMeasurement
		| DashboardDeviceClusterElectricalPowerMeasurement
		| DashboardDeviceClusterCO2ConcentrationMeasurement
		| DashboardDeviceClusterAirQuality
		| DashboardDeviceClusterPM25ConcentrationMeasurement
		| DashboardDeviceClusterAirQualityGroup
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
	customIcon?: IncludedIconNames;
	managementUrl?: string;
	position?: { x: number; y: number };
	status?: 'online' | 'offline';
}

const sceneActions = z.array(
	z.union([
		z.object({
			deviceId: z.string().optional(),
			groupId: z.string().optional(),
			cluster: z.literal(DeviceClusterName.ON_OFF),
			action: z.object({
				isOn: z.boolean(),
			}),
			excludeDeviceIds: z.array(z.string()).optional(),
		}),
		z.object({
			deviceId: z.string().optional(),
			groupId: z.string().optional(),
			cluster: z.literal(DeviceClusterName.WINDOW_COVERING),
			action: z.object({
				targetPositionLiftPercentage: z.number(),
			}),
			excludeDeviceIds: z.array(z.string()).optional(),
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
			excludeDeviceIds: z.array(z.string()).optional(),
		}),
		z.object({
			deviceId: z.string().optional(),
			groupId: z.string().optional(),
			cluster: z.literal(DeviceClusterName.COLOR_CONTROL),
			action: z.object({
				paletteId: z.string(),
			}),
			excludeDeviceIds: z.array(z.string()).optional(),
		}),
		z.object({
			deviceId: z.string().optional(),
			groupId: z.string().optional(),
			cluster: z.literal(DeviceClusterName.LEVEL_CONTROL),
			action: z.object({
				level: z.number(),
			}),
			excludeDeviceIds: z.array(z.string()).optional(),
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
			excludeDeviceIds: z.array(z.string()).optional(),
		}),
		z.object({
			cluster: z.literal('notification'),
			action: z.object({
				title: z.string(),
				body: z.string(),
			}),
		}),
		z.object({
			cluster: z.literal('room-temperature'),
			action: z.union([
				z.object({
					roomName: z.string(),
					mode: z.enum(['setTarget', 'returnToSchedule']),
					targetTemperature: z.number().optional(),
				}),
				z.object({
					mode: z.literal('activateState'),
					stateId: z.string(),
				}),
			]),
		}),
		z.object({
			cluster: z.literal('set-variable'),
			action: z.object({
				variableName: z.string().min(1),
				value: z.boolean(),
			}),
		}),
	])
);

const sceneTriggers = z
	.array(
		z.object({
			trigger: z.union([
				z.object({
					type: z.literal(SceneTriggerType.OCCUPANCY),
					deviceId: z.string(),
					occupied: z.boolean(),
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
				z.object({
					type: z.literal(SceneTriggerType.CRON),
					intervalMinutes: z.number().min(1),
				}),
				z.object({
					type: z.literal(SceneTriggerType.LOCATION_WITHIN_RANGE),
					deviceId: z.string(),
					targetId: z.string(),
					rangeKm: z.number(),
					enteredRange: z.boolean(),
				}),
				z.object({
					type: z.literal(SceneTriggerType.POWER_THRESHOLD),
					deviceId: z.string(),
					thresholdWatts: z.number().min(0),
					direction: z.enum(['above', 'below']),
				}),
			]),
			conditions: z
				.array(
					z.union([
						z.object({
							type: z.literal(SceneConditionType.HOST_HOME),
							hostId: z.string(),
							shouldBeHome: z.boolean(),
							checkOnManual: z.boolean().optional(),
						}),
						z.object({
							type: z.literal(SceneConditionType.DEVICE_ON),
							deviceId: z.string(),
							shouldBeOn: z.boolean(),
							checkOnManual: z.boolean().optional(),
						}),
						z.object({
							type: z.literal(SceneConditionType.TIME_WINDOW),
							checkOnManual: z.boolean().optional(),
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
							checkOnManual: z.boolean().optional(),
						}),
						z.object({
							type: z.literal(SceneConditionType.CUSTOM_JS),
							code: z.string(),
							checkOnManual: z.boolean().optional(),
						}),
						z.object({
							type: z.literal(SceneConditionType.VARIABLE),
							variableName: z.string().min(1),
							shouldBeTrue: z.boolean(),
							invert: z.boolean().optional(),
							checkOnManual: z.boolean().optional(),
						}),
						z.object({
							type: z.literal(SceneConditionType.DELAY),
							seconds: z.number().min(0).max(3600),
							checkOnManual: z.boolean().optional(),
						}),
					])
				)
				.optional(),
		})
	)
	.optional();

function _initRouting({ db, modules, wsPublish: _wsPublish }: ModuleConfig, api: DeviceAPI) {
	// Create a deduplicated WebSocket publisher to avoid sending duplicate messages
	const wsPublish = createDeduplicatedTypedWSPublish<DeviceWebsocketServerMessage>(_wsPublish);

	const notifyDeviceChanges = async () => {
		void wsPublish({
			type: 'devices',
			devices: await listDevicesWithValues(api, modules),
		});
	};

	const notifyVariableChanges = () => {
		void wsPublish({
			type: 'variables',
			variables: api.sceneAPI.getAllVariables(),
		});
	};

	// Set up variable change notification
	api.sceneAPI.setOnVariableChange(notifyVariableChanges);

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
			'/reconnect/:deviceId': async (req, _server, { json }) => {
				const { deviceId } = req.params;

				const storedDevices = api.getStoredDevices();
				const device = storedDevices[deviceId];
				if (!device) {
					return json({ error: 'Device not found' }, { status: 404 });
				}

				if (device.source === DeviceSource.WLED.value) {
					modules.wled.refresh();
				} else if (device.source === DeviceSource.MATTER.value) {
					try {
						const matterServer = await modules.matter.server.value;
						await matterServer.reconnectDevice(deviceId);
					} catch (error) {
						const message = error instanceof Error ? error.message : 'Reconnect failed';
						return json({ error: message }, { status: 500 });
					}
				}
				return json({ success: true });
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
				const history = await api.booleanStateTracker.getHistory(req.params.deviceId, 7);
				return json({ history });
			},
			'/temperature/:deviceId/:timeframe': async (req, _server, { json }) => {
				const timeframe = parseInt(req.params.timeframe, 10);
				const history = await api.temperatureTracker.getHistory(
					req.params.deviceId,
					timeframe
				);
				return json({ history });
			},
			'/fridge/:deviceId/:timeframe': async (req, _server, { json }) => {
				const timeframe = parseInt(req.params.timeframe, 10);
				const history = await api.fridgeTracker.getHistory(req.params.deviceId, timeframe);
				return json({ history });
			},
			'/washer/:deviceId/:timeframe': async (req, _server, { json }) => {
				const timeframe = parseInt(req.params.timeframe, 10);
				const history = await api.washerTracker.getHistory(req.params.deviceId, timeframe);
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
			'/power/:deviceId/:timeframe': async (req, _server, { json }) => {
				const timeframe = parseInt(req.params.timeframe, 10);
				const history = await api.powerTracker.getHistory(
					req.params.deviceId,
					1000,
					timeframe
				);
				return json({ history });
			},
			'/power/all/:timeframe': async (req, _server, { json }) => {
				const timeframe = parseInt(req.params.timeframe, 10);
				const history = await api.powerTracker.getAllDevicesHistory(1000, timeframe);
				return json({ history });
			},
			'/co2/:deviceId/:timeframe': async (req, _server, { json }) => {
				const timeframe = parseInt(req.params.timeframe, 10);
				const history = await api.co2Tracker.getHistory(req.params.deviceId, timeframe);
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
			'/updatePosition': withRequestBody(
				z.object({
					deviceId: z.string(),
					position: z
						.object({
							x: z.number(),
							y: z.number(),
						})
						.nullable(),
					icon: z.string().optional().nullable(),
				}),
				(body, _req, _server, { json }) => {
					const { deviceId, position, icon } = body;

					if (api.updateDevicePosition(deviceId, position)) {
						// Update icon if provided
						if (icon !== undefined) {
							api.updateDeviceIcon(deviceId, icon as IncludedIconNames | null);
						}
						return json({ success: true });
					}

					return json({ error: 'Device not found' }, { status: 404 });
				}
			),
			'/device/:deviceId/delete': (req, _server, { json }) => {
				const { deviceId } = req.params;
				const storedDevices = api.getStoredDevices();
				const device = storedDevices[deviceId];

				if (!device) {
					return json({ error: 'Device not found' }, { status: 404 });
				}

				// Only allow deleting offline devices
				if (device.status !== 'offline') {
					return json({ error: 'Can only delete offline devices' }, { status: 400 });
				}

				// Remove device from registry
				const updatedDevices = { ...storedDevices };
				delete updatedDevices[deviceId];

				db.update((old) => ({
					...old,
					device_registry: updatedDevices,
				}));

				return json({ success: true });
			},
			'/rooms': (_req, _server, { json }) => {
				const rooms = api.getRooms(api.getStoredDevices());
				return json({ rooms });
			},
			'/rooms/updatePolygon': withRequestBody(
				z.object({
					roomName: z.string(),
					polygon: z.array(z.object({ x: z.number(), y: z.number() })),
				}),
				(body, _req, _server, { json }) => {
					api.updateRoomPolygon(body.roomName, body.polygon);
					return json({ success: true });
				}
			),
			'/cluster-icons': (_req, _server, { json }) => {
				const overrides = api.getAllClusterIconOverrides();
				return json({ overrides });
			},
			'/cluster-icons/:clusterName': withRequestBody(
				z.object({
					icon: z.string().nullable(),
				}),
				(body, req, _server, { json }) => {
					const clusterName = req.params.clusterName as DeviceClusterName;
					if (!Object.values(DeviceClusterName).includes(clusterName)) {
						return json({ error: 'Invalid cluster name' }, { status: 400 });
					}
					if (api.updateClusterIcon(clusterName, body.icon as IncludedIconNames | null)) {
						return json({ success: true });
					}
					return json({ error: 'Failed to update cluster icon' }, { status: 500 });
				}
			),
			'/layout': (_req, _server, { json }) => {
				const layout = (db as Database<{ house_layout: HouseLayout }>).current()
					.house_layout;
				return json({ layout: layout || null });
			},
			'/layout/save': withRequestBody(
				z.object({
					walls: z.array(
						z.object({
							id: z.string(),
							start: z.object({ x: z.number(), y: z.number() }),
							end: z.object({ x: z.number(), y: z.number() }),
						})
					),
					doors: z.array(
						z.object({
							id: z.string(),
							wallId: z.string(),
							start: z.object({ x: z.number(), y: z.number() }),
							end: z.object({ x: z.number(), y: z.number() }),
						})
					),
					roomMappings: z.record(z.string()),
				}),
				(body, _req, _server, { json }) => {
					(db as Database<{ house_layout: HouseLayout }>).update((old) => ({
						...old,
						house_layout: body,
					}));
					return json({ success: true });
				}
			),
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
			[validateClusterRoute('/cluster/DoorLock')]: withRequestBody(
				z.object({
					deviceIds: z.array(z.string()),
					action: z.enum(['lock', 'unlock', 'toggle', 'unlatch']),
				}),
				async (body, _req, _server, res) =>
					performActionForDeviceCluster(
						api,
						res,
						body.deviceIds,
						DeviceDoorLockCluster,
						async (cluster) => {
							switch (body.action) {
								case 'lock':
									await cluster.lockDoor();
									break;
								case 'unlock':
									await cluster.unlockDoor();
									break;
								case 'toggle':
									await cluster.toggle();
									break;
								case 'unlatch':
									if (cluster.unlatchDoor) {
										await cluster.unlatchDoor();
									} else {
										await cluster.unlockDoor();
									}
									break;
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
				z.union([
					z.object({
						deviceIds: z.array(z.string()),
						hue: z.number().min(0).max(360),
						saturation: z.number().min(0).max(100),
						value: z.number().min(0).max(100).optional(),
					}),
					z.object({
						deviceIds: z.array(z.string()),
						colorTemperature: z.number(),
					}),
				]),
				async (body, _req, _server, res) => {
					if ('hue' in body && 'saturation' in body) {
						return performActionForDeviceCluster(
							api,
							res,
							body.deviceIds,
							DeviceColorControlXYCluster,
							async (cluster) => {
								const color = Color.fromHSV(
									body.hue / 360,
									body.saturation / 100,
									(body.value ?? 100) / 100
								);
								await cluster.setColor({
									colors: [color],
								});
							}
						);
					} else {
						return performActionForDeviceCluster(
							api,
							res,
							body.deviceIds,
							DeviceColorControlTemperatureCluster,
							async (cluster) => {
								await cluster.setColorTemperature({
									colorTemperature: body.colorTemperature,
								});
							}
						);
					}
				}
			),
			[validateClusterRoute('/cluster/LevelControl')]: withRequestBody(
				z.object({
					deviceIds: z.array(z.string()),
					level: z.number().min(0).max(1),
				}),
				async (body, _req, _server, res) =>
					performActionForDeviceCluster(
						api,
						res,
						body.deviceIds,
						DeviceLevelControlCluster,
						async (cluster) => {
							await cluster.setLevel({
								level: body.level,
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
					actions: sceneActions,
					triggers: sceneTriggers,
					showOnHome: z.boolean().optional(),
					category: z.string().optional(),
					order: z.number().optional(),
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
					actions: sceneActions,
					triggers: sceneTriggers,
					showOnHome: z.boolean().optional(),
					category: z.string().optional(),
					order: z.number().optional(),
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
				const success = await api.sceneAPI.triggerScene(req.params.sceneId, {
					type: 'manual',
					source: 'manual',
				});
				if (!success) {
					return json({ error: 'Scene not found or execution failed' }, { status: 404 });
				}
				return json({ success: true });
			},
			'/scenes/history': async (_req, _server, { json }) => {
				const limit = 100;
				const history = await api.sceneAPI.getSceneHistory(limit);
				return json({ history });
			},
			'/scenes/:sceneId/history': async (req, _server, { json }) => {
				const limit = 100;
				const history = await api.sceneAPI.getSceneHistory(limit, req.params.sceneId);
				return json({ history });
			},
			'/variables/list': (_req, _server, { json }) => {
				const variables = api.sceneAPI.getAllVariables();
				return json({ variables });
			},
			'/variables/:variableName/set': (req, _server, { json }) => {
				if (!req.params.variableName || req.params.variableName.trim() === '') {
					return json({ error: 'Variable name is required' }, { status: 400 });
				}
				api.sceneAPI.setVariable(req.params.variableName, true);
				void wsPublish({
					type: 'variables',
					variables: api.sceneAPI.getAllVariables(),
				});
				return json({ success: true });
			},
			'/variables/:variableName/clear': (req, _server, { json }) => {
				if (!req.params.variableName || req.params.variableName.trim() === '') {
					return json({ error: 'Variable name is required' }, { status: 400 });
				}
				api.sceneAPI.clearVariable(req.params.variableName);
				void wsPublish({
					type: 'variables',
					variables: api.sceneAPI.getAllVariables(),
				});
				return json({ success: true });
			},
			'/variables/:variableName': withRequestBody(
				z.object({
					value: z.boolean(),
				}),
				(body, req, _server, { json }) => {
					if (!req.params.variableName || req.params.variableName.trim() === '') {
						return json({ error: 'Variable name is required' }, { status: 400 });
					}
					api.sceneAPI.setVariable(req.params.variableName, body.value);
					void wsPublish({
						type: 'variables',
						variables: api.sceneAPI.getAllVariables(),
					});
					return json({ success: true });
				}
			),
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
			'/groups/:groupId/updatePosition': withRequestBody(
				z.object({
					position: z
						.object({
							x: z.number(),
							y: z.number(),
						})
						.nullable(),
				}),
				(body, req, _server, { json }) => {
					const success = api.groupAPI.updateGroupPosition(
						req.params.groupId,
						body.position
					);
					if (!success) {
						return json({ error: 'Group not found' }, { status: 404 });
					}
					return json({ success: true });
				}
			),
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

export type DeviceWebsocketServerMessage =
	| {
			type: 'devices';
			devices: DeviceListWithValuesResponse;
	  }
	| {
			type: 'variables';
			variables: Record<string, boolean>;
	  };

export type DeviceWebsocketClientMessage = {
	type: 'refreshDevices';
};

const getClusterState = async (
	api: DeviceAPI,
	_cluster: Cluster | null,
	clusterName: DeviceClusterName,
	deviceId: string,
	modules?: AllModules
): Promise<DashboardDeviceClusterWithState> => {
	if (clusterName === DeviceClusterName.ON_OFF) {
		if (!_cluster) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				isOn: false,
			};
		}
		const cluster = _cluster as DeviceOnOffCluster;
		const isOn = await cluster.isOn.get();
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName, api),
			isOn: isOn ?? false,
		};
	}
	if (clusterName === DeviceClusterName.DOOR_LOCK) {
		if (!_cluster) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				lockState: LockState.Unlocked,
			};
		}
		const cluster = _cluster as DeviceDoorLockCluster;
		const lockState = await cluster.lockState.get();
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName, api),
			lockState: lockState ?? LockState.Unlocked,
		};
	}
	if (clusterName === DeviceClusterName.WINDOW_COVERING) {
		if (!_cluster) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				targetPositionLiftPercentage: 0,
			};
		}
		const cluster = _cluster as DeviceWindowCoveringCluster;
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName, api),
			targetPositionLiftPercentage: (await cluster.targetPositionLiftPercentage.get()) ?? 0,
		};
	}
	if (clusterName === DeviceClusterName.POWER_SOURCE) {
		if (!_cluster) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				batteryPercentage: 0,
			};
		}
		const cluster = _cluster as DevicePowerSourceCluster;
		const batteryLevel = await cluster.batteryChargeLevel.get();
		if (batteryLevel !== null) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				batteryPercentage: batteryLevel,
			};
		}
	}
	if (clusterName === DeviceClusterName.OCCUPANCY_SENSING) {
		if (!_cluster) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				occupied: false,
				lastTriggered: undefined,
			};
		}
		const cluster = _cluster as DeviceOccupancySensingCluster;
		const occupied = await cluster.occupancy.get();
		const lastEvent = await api.occupancyTracker.getLastTriggered(deviceId);
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName, api),
			occupied: occupied ?? false,
			lastTriggered: lastEvent?.timestamp,
		};
	}
	if (clusterName === DeviceClusterName.TEMPERATURE_MEASUREMENT) {
		if (!_cluster) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				temperature: 20.0,
			};
		}
		const cluster = _cluster as DeviceTemperatureMeasurementCluster;
		const temperature = await cluster.temperature.get();
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName, api),
			temperature: temperature ?? 20.0,
		};
	}
	if (clusterName === DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT) {
		if (!_cluster) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				humidity: 50.0,
			};
		}
		const cluster = _cluster as DeviceRelativeHumidityMeasurementCluster;
		const humidity = await cluster.relativeHumidity.get();
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName, api),
			humidity: humidity ?? 50.0,
		};
	}
	if (clusterName === DeviceClusterName.ILLUMINANCE_MEASUREMENT) {
		if (!_cluster) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				illuminance: 0,
			};
		}
		const cluster = _cluster as DeviceIlluminanceMeasurementCluster;
		const illuminance = await cluster.illuminance.get();
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName, api),
			illuminance,
		};
	}
	if (clusterName === DeviceClusterName.BOOLEAN_STATE) {
		if (!_cluster) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				state: false,
				lastChanged: undefined,
			};
		}
		const cluster = _cluster as DeviceBooleanStateCluster<boolean>;
		const state = await cluster.state.get();
		const lastEvent = await api.booleanStateTracker.getLastChanged(deviceId);
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName, api),
			state: state ?? false,
			lastChanged: lastEvent?.timestamp,
		};
	}
	if (clusterName === DeviceClusterName.FRIDGE) {
		if (!_cluster) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				freezerDoorOpen: false,
				coolerDoorOpen: false,
				fridgeTempC: undefined,
				freezerTempC: undefined,
			};
		}
		const cluster = _cluster as DeviceFridgeCluster;
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName, api),
			freezerDoorOpen: (await cluster.freezerDoorOpen.get()) ?? false,
			coolerDoorOpen: (await cluster.coolerDoorOpen.get()) ?? false,
			fridgeTempC: await cluster.fridgeTempC.get(),
			freezerTempC: await cluster.freezerTempC.get(),
		};
	}
	if (clusterName === DeviceClusterName.THREE_D_PRINTER) {
		const videoStreamUrl = modules?.bambulab?.getVideoStreamUrl?.();
		if (!_cluster) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				printState: undefined,
				bedTemperature: undefined,
				nozzleTemperature: undefined,
				bedTargetTemperature: undefined,
				nozzleTargetTemperature: undefined,
				currentLayer: undefined,
				totalLayers: undefined,
				remainingTimeMinutes: undefined,
				progress: undefined,
				currentFile: undefined,
				usedTray: undefined,
				videoStreamUrl,
				ams: undefined,
			};
		}
		const cluster = _cluster as DeviceThreeDPrinterCluster;
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName, api),
			printState: await cluster.printState.get(),
			bedTemperature: await cluster.bedTemperature.get(),
			nozzleTemperature: await cluster.nozzleTemperature.get(),
			bedTargetTemperature: await cluster.bedTargetTemperature.get(),
			nozzleTargetTemperature: await cluster.nozzleTargetTemperature.get(),
			currentLayer: await cluster.currentLayer.get(),
			totalLayers: await cluster.totalLayers.get(),
			remainingTimeMinutes: await cluster.remainingTimeMinutes.get(),
			progress: await cluster.progress.get(),
			currentFile: await cluster.currentFile.get(),
			usedTray: await cluster.usedTray.get(),
			videoStreamUrl,
			ams: await cluster.ams.get(),
		};
	}
	if (clusterName === DeviceClusterName.WASHER) {
		if (!_cluster) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				machineState: undefined,
				operatingState: undefined,
				washerJobState: undefined,
				done: undefined,
				completionTime: undefined,
				remainingTimeMinutes: undefined,
				remainingTimeStr: undefined,
				detergentRemainingCc: undefined,
				detergentInitialCc: undefined,
				softenerRemainingCc: undefined,
				softenerInitialCc: undefined,
				cycle: undefined,
				cycleType: undefined,
				phase: undefined,
				progressPercent: undefined,
				scheduledPhases: undefined,
			};
		}
		const cluster = _cluster as DeviceWasherCluster;
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName, api),
			machineState: await cluster.machineState.get(),
			operatingState: await cluster.operatingState.get(),
			washerJobState: await cluster.washerJobState.get(),
			done: await cluster.done.get(),
			completionTime: await cluster.completionTime.get(),
			remainingTimeMinutes: await cluster.remainingTimeMinutes.get(),
			remainingTimeStr: await cluster.remainingTimeStr.get(),
			detergentRemainingCc: await cluster.detergentRemainingCc.get(),
			detergentInitialCc: await cluster.detergentInitialCc.get(),
			softenerRemainingCc: await cluster.softenerRemainingCc.get(),
			softenerInitialCc: await cluster.softenerInitialCc.get(),
			cycle: await cluster.cycle.get(),
			cycleType: await cluster.cycleType.get(),
			phase: await cluster.phase.get(),
			progressPercent: await cluster.progressPercent.get(),
			scheduledPhases: await cluster.scheduledPhases.get(),
		};
	}
	if (clusterName === DeviceClusterName.SWITCH) {
		if (!_cluster) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				label: '',
				index: 0,
				totalCount: 0,
			};
		}
		const cluster = _cluster as DeviceSwitchCluster;
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName, api),
			label: cluster.getLabel(),
			index: cluster.getIndex(),
			totalCount: cluster.getTotalCount(),
		};
	}
	if (
		clusterName === DeviceClusterName.COLOR_CONTROL &&
		(
			_cluster as DeviceColorControlXYCluster | DeviceColorControlTemperatureCluster | null
		)?.getClusterVariant() === 'xy'
	) {
		if (!_cluster) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				clusterVariant: 'xy',
				color: { hue: 0, saturation: 0, value: 0 },
				mergedClusters: {},
			};
		}
		const cluster = _cluster as DeviceColorControlXYCluster;
		const color = (await cluster.color.get()) ?? new Color(0, 0, 0);
		const hsv = color.toHSV();
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName, api),
			clusterVariant: 'xy',
			color: hsv,
			mergedClusters: {},
		};
	}
	if (
		clusterName === DeviceClusterName.COLOR_CONTROL &&
		(
			_cluster as DeviceColorControlXYCluster | DeviceColorControlTemperatureCluster | null
		)?.getClusterVariant() === 'temperature'
	) {
		if (!_cluster) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				clusterVariant: 'temperature',
				colorTemperature: undefined,
				minColorTemperature: undefined,
				maxColorTemperature: undefined,
			};
		}
		const cluster = _cluster as DeviceColorControlTemperatureCluster;
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName, api),
			clusterVariant: 'temperature',
			colorTemperature: await cluster.colorTemperature.get(),
			minColorTemperature: await cluster.colorTemperatureMin.get(),
			maxColorTemperature: await cluster.colorTemperatureMax.get(),
		};
	}
	if (clusterName === DeviceClusterName.LEVEL_CONTROL) {
		if (!_cluster) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				currentLevel: 0,
				levelName: '',
				step: 1 / 100,
			};
		}
		const cluster = _cluster as DeviceLevelControlCluster;
		const level = await cluster.currentLevel.get();
		const name = await cluster.name.get();
		const step = await cluster.step.get();
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName, api),
			currentLevel: level,
			levelName: name,
			step: step,
		};
	}
	if (clusterName === DeviceClusterName.ACTIONS) {
		if (!_cluster) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				actions: [],
				activeActionId: undefined,
			};
		}
		const cluster = _cluster as DeviceActionsCluster;
		const actionList = await cluster.actionList.get();
		const activeAction = actionList.find((a) => a.state === Actions.ActionState.Active);
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName, api),
			actions: actionList,
			activeActionId: activeAction?.id,
		};
	}
	if (clusterName === DeviceClusterName.THERMOSTAT) {
		if (!_cluster) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				currentTemperature: 20.0,
				targetTemperature: 20.0,
				mode: ThermostatMode.OFF,
				isHeating: false,
				minTemperature: 5.0,
				maxTemperature: 30.0,
			};
		}
		const cluster = _cluster as DeviceThermostatCluster;
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName, api),
			currentTemperature: (await cluster.currentTemperature.get()) ?? 20.0,
			targetTemperature: (await cluster.targetTemperature.get()) ?? 20.0,
			mode: (await cluster.mode.get()) ?? ThermostatMode.OFF,
			isHeating: (await cluster.isHeating.get()) ?? false,
			minTemperature: 5.0,
			maxTemperature: 30.0,
		};
	}
	if (clusterName === DeviceClusterName.ELECTRICAL_ENERGY_MEASUREMENT) {
		if (!_cluster) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				totalEnergy: '0.00',
				period: undefined,
			};
		}
		const cluster = _cluster as DeviceElectricalEnergyMeasurementCluster;
		const totalEnergyMwh = await cluster.totalEnergy.get();
		const period = await cluster.totalEnergyPeriod.get();

		// Convert mWh to kWh for display (1 kWh = 1,000,000 mWh)
		const totalEnergyKwh = Number(totalEnergyMwh) / 1_000_000;
		const totalEnergy = totalEnergyKwh.toFixed(2);

		return {
			name: clusterName,
			icon: getClusterIconName(clusterName, api),
			totalEnergy,
			period,
		};
	}
	if (clusterName === DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT) {
		if (!_cluster) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				activePower: 0,
			};
		}
		const cluster = _cluster as DeviceElectricalPowerMeasurementCluster;
		const activePower = await cluster.activePower.get();
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName, api),
			activePower: activePower ?? 0,
		};
	}
	if (clusterName === DeviceClusterName.CARBON_DIOXIDE_CONCENTRATION_MEASUREMENT) {
		if (!_cluster) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				clusterVariant: 'numeric+levelIndication',
				concentration: undefined,
				level: 0 as CO2LevelValue, // Unknown
			};
		}
		const cluster =
			_cluster as DeviceCarbonDioxideConcentrationMeasurementWithNumericAndLevelIndicationCluster;
		const concentration = await cluster.concentration.get();
		const level = await cluster.level.get();
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName, api),
			clusterVariant: 'numeric+levelIndication',
			concentration,
			level: level as CO2LevelValue,
		};
	}
	if (clusterName === DeviceClusterName.AIR_QUALITY) {
		if (!_cluster) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				airQuality: 0 as AirQualityValue, // Unknown
			};
		}
		const cluster = _cluster as DeviceAirQualityCluster;
		const airQuality = await cluster.airQuality.get();
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName, api),
			airQuality: (airQuality ?? 0) as AirQualityValue,
		};
	}
	if (clusterName === DeviceClusterName.PM_2_5_CONCENTRATION_MEASUREMENT) {
		if (!_cluster) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName, api),
				clusterVariant: 'numeric+levelIndication',
				concentration: undefined,
				level: 0 as CO2LevelValue, // Unknown
			};
		}
		const cluster =
			_cluster as DevicePm25ConcentrationMeasurementWithNumericAndLevelIndicationCluster;
		const concentration = await cluster.concentration.get();
		const level = await cluster.level.get();
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName, api),
			clusterVariant: 'numeric+levelIndication',
			concentration,
			level: level as CO2LevelValue,
		};
	}
	return {
		name: clusterName,
		icon: getClusterIconName(clusterName, api),
	} as DashboardDeviceClusterWithState;
};

async function listDevicesWithValues(api: DeviceAPI, modules: AllModules) {
	const deviceApi = await modules.device.api.value;
	const devices = [...Object.values(await deviceApi.devices.get())];
	const storedDevices = deviceApi.getStoredDevices();
	const rooms = deviceApi.getRooms(storedDevices);
	const responseDevices: DashboardDeviceResponse[] = [];

	const _getClusterState = async (cluster: Cluster, deviceId: string) => {
		if (!clusterStateCache.has(cluster)) {
			const clusterState = await getClusterState(
				api,
				cluster,
				cluster.getBaseCluster().clusterName,
				deviceId,
				modules
			);
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
				cluster: await _getClusterState(
					cluster,

					deviceId
				),
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
				if (
					clusters[DeviceClusterName.COLOR_CONTROL] &&
					clusters[DeviceClusterName.COLOR_CONTROL].clusterVariant === 'xy'
				) {
					mergedClusters.push({
						name: DeviceClusterName.COLOR_CONTROL,
						icon: getClusterIconName(DeviceClusterName.COLOR_CONTROL, api),
						clusterVariant: 'xy',
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

				// Merge ElectricalEnergyMeasurement/ElectricalPowerMeasurement with OnOff cluster
				// Prefer power measurement for current power if available
				const energyCluster = clusters[DeviceClusterName.ELECTRICAL_ENERGY_MEASUREMENT];
				const powerCluster = clusters[DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT];
				const colorControlCluster =
					clusters[DeviceClusterName.COLOR_CONTROL] &&
					'colorTemperature' in clusters[DeviceClusterName.COLOR_CONTROL]
						? (clusters[
								DeviceClusterName.COLOR_CONTROL
							] as DashboardDeviceClusterColorControlTemperature)
						: undefined;
				const levelControlCluster = clusters[DeviceClusterName.LEVEL_CONTROL];

				if (
					clusters[DeviceClusterName.ON_OFF] &&
					(energyCluster || powerCluster || colorControlCluster || levelControlCluster)
				) {
					mergedClusters.push({
						name: DeviceClusterName.ON_OFF,
						icon: getClusterIconName(DeviceClusterName.ON_OFF, api),
						isOn: clusters[DeviceClusterName.ON_OFF].isOn,
						mergedClusters: {
							[DeviceClusterName.ELECTRICAL_ENERGY_MEASUREMENT]: energyCluster,
							[DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT]: powerCluster,
							[DeviceClusterName.COLOR_CONTROL]: colorControlCluster,
							[DeviceClusterName.LEVEL_CONTROL]: levelControlCluster,
						},
					});
					// Remove merged clusters so they don't appear separately
					delete clusters[DeviceClusterName.ON_OFF];
					delete clusters[DeviceClusterName.ELECTRICAL_ENERGY_MEASUREMENT];
					delete clusters[DeviceClusterName.ELECTRICAL_POWER_MEASUREMENT];
					delete clusters[DeviceClusterName.COLOR_CONTROL];
					delete clusters[DeviceClusterName.LEVEL_CONTROL];
				}

				// Merge air quality clusters (AirQuality, CO2, PM2.5, optionally RelativeHumidityMeasurement, IlluminanceMeasurement, and OnOff)
				const hasAirQualitySensor =
					clusters[DeviceClusterName.AIR_QUALITY] ||
					clusters[DeviceClusterName.CARBON_DIOXIDE_CONCENTRATION_MEASUREMENT] ||
					clusters[DeviceClusterName.PM_2_5_CONCENTRATION_MEASUREMENT];

				if (hasAirQualitySensor) {
					mergedClusters.push({
						name: DeviceClusterName.AIR_QUALITY,
						icon: getClusterIconName(DeviceClusterName.AIR_QUALITY, api),
						mergedClusters: {
							[DeviceClusterName.AIR_QUALITY]:
								clusters[DeviceClusterName.AIR_QUALITY],
							[DeviceClusterName.CARBON_DIOXIDE_CONCENTRATION_MEASUREMENT]:
								clusters[
									DeviceClusterName.CARBON_DIOXIDE_CONCENTRATION_MEASUREMENT
								],
							[DeviceClusterName.PM_2_5_CONCENTRATION_MEASUREMENT]:
								clusters[DeviceClusterName.PM_2_5_CONCENTRATION_MEASUREMENT],
							[DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT]:
								clusters[DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT],
							[DeviceClusterName.ILLUMINANCE_MEASUREMENT]:
								clusters[DeviceClusterName.ILLUMINANCE_MEASUREMENT],
							[DeviceClusterName.ON_OFF]: clusters[DeviceClusterName.ON_OFF],
							[DeviceClusterName.TEMPERATURE_MEASUREMENT]:
								clusters[DeviceClusterName.TEMPERATURE_MEASUREMENT],
						},
					} as DashboardDeviceClusterAirQualityGroup);
					// Remove merged clusters so they don't appear separately
					delete clusters[DeviceClusterName.AIR_QUALITY];
					delete clusters[DeviceClusterName.CARBON_DIOXIDE_CONCENTRATION_MEASUREMENT];
					delete clusters[DeviceClusterName.PM_2_5_CONCENTRATION_MEASUREMENT];
					delete clusters[DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT];
					delete clusters[DeviceClusterName.ILLUMINANCE_MEASUREMENT];
					delete clusters[DeviceClusterName.ON_OFF];
					delete clusters[DeviceClusterName.TEMPERATURE_MEASUREMENT];
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
						? getClusterIconName(DeviceClusterName.OCCUPANCY_SENSING, api)
						: clusters[DeviceClusterName.TEMPERATURE_MEASUREMENT]
							? getClusterIconName(DeviceClusterName.TEMPERATURE_MEASUREMENT, api)
							: getClusterIconName(DeviceClusterName.ILLUMINANCE_MEASUREMENT, api);

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
					} as DashboardDeviceClusterOccupancySensorGroup);
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
		const sensorGroups: DashboardDeviceClusterOccupancySensorGroup[] = [];
		const airQualityGroups: DashboardDeviceClusterAirQualityGroup[] = [];
		const otherClusters: DashboardDeviceClusterWithState[] = [];

		for (const cluster of mergedAllClusters) {
			if (
				cluster.name === DeviceClusterName.OCCUPANCY_SENSING &&
				'mergedClusters' in cluster
			) {
				sensorGroups.push(cluster as DashboardDeviceClusterOccupancySensorGroup);
			} else if (
				cluster.name === DeviceClusterName.AIR_QUALITY &&
				'mergedClusters' in cluster
			) {
				airQualityGroups.push(cluster as DashboardDeviceClusterAirQualityGroup);
			} else {
				otherClusters.push(cluster);
			}
		}

		// If we have multiple air quality groups, merge them into one
		if (airQualityGroups.length > 1) {
			const mergedAirQualityGroup: DashboardDeviceClusterAirQualityGroup = {
				name: DeviceClusterName.AIR_QUALITY,
				icon: getClusterIconName(DeviceClusterName.AIR_QUALITY, api),
				mergedClusters: {
					[DeviceClusterName.AIR_QUALITY]: undefined,
					[DeviceClusterName.CARBON_DIOXIDE_CONCENTRATION_MEASUREMENT]: undefined,
					[DeviceClusterName.PM_2_5_CONCENTRATION_MEASUREMENT]: undefined,
					[DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT]: undefined,
					[DeviceClusterName.ILLUMINANCE_MEASUREMENT]: undefined,
					[DeviceClusterName.ON_OFF]: undefined,
					[DeviceClusterName.TEMPERATURE_MEASUREMENT]: undefined,
				},
			};

			// Merge all air quality data from different groups
			for (const group of airQualityGroups) {
				if (group.mergedClusters[DeviceClusterName.AIR_QUALITY]) {
					mergedAirQualityGroup.mergedClusters[DeviceClusterName.AIR_QUALITY] =
						group.mergedClusters[DeviceClusterName.AIR_QUALITY];
				}
				if (
					group.mergedClusters[DeviceClusterName.CARBON_DIOXIDE_CONCENTRATION_MEASUREMENT]
				) {
					mergedAirQualityGroup.mergedClusters[
						DeviceClusterName.CARBON_DIOXIDE_CONCENTRATION_MEASUREMENT
					] =
						group.mergedClusters[
							DeviceClusterName.CARBON_DIOXIDE_CONCENTRATION_MEASUREMENT
						];
				}
				if (group.mergedClusters[DeviceClusterName.PM_2_5_CONCENTRATION_MEASUREMENT]) {
					mergedAirQualityGroup.mergedClusters[
						DeviceClusterName.PM_2_5_CONCENTRATION_MEASUREMENT
					] = group.mergedClusters[DeviceClusterName.PM_2_5_CONCENTRATION_MEASUREMENT];
				}
				if (group.mergedClusters[DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT]) {
					mergedAirQualityGroup.mergedClusters[
						DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT
					] = group.mergedClusters[DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT];
				}
				if (group.mergedClusters[DeviceClusterName.ILLUMINANCE_MEASUREMENT]) {
					mergedAirQualityGroup.mergedClusters[
						DeviceClusterName.ILLUMINANCE_MEASUREMENT
					] = group.mergedClusters[DeviceClusterName.ILLUMINANCE_MEASUREMENT];
				}
				if (group.mergedClusters[DeviceClusterName.ON_OFF]) {
					mergedAirQualityGroup.mergedClusters[DeviceClusterName.ON_OFF] =
						group.mergedClusters[DeviceClusterName.ON_OFF];
				}
				if (group.mergedClusters[DeviceClusterName.TEMPERATURE_MEASUREMENT]) {
					mergedAirQualityGroup.mergedClusters[
						DeviceClusterName.TEMPERATURE_MEASUREMENT
					] = group.mergedClusters[DeviceClusterName.TEMPERATURE_MEASUREMENT];
				}
			}

			// Update otherClusters to include the merged group
			const finalOtherClusters = mergedAllClusters.filter(
				(c) => !(c.name === DeviceClusterName.AIR_QUALITY && 'mergedClusters' in c)
			);
			mergedAllClusters = [...finalOtherClusters, mergedAirQualityGroup];
		}

		// If we have multiple sensor groups, merge them into one
		if (sensorGroups.length > 1) {
			const mergedSensorGroup: DashboardDeviceClusterOccupancySensorGroup = {
				name: DeviceClusterName.OCCUPANCY_SENSING,
				icon: getClusterIconName(DeviceClusterName.OCCUPANCY_SENSING, api),
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

		// If we have multiple air quality groups, merge them into one
		if (airQualityGroups.length > 1) {
			const mergedAirQualityGroup: DashboardDeviceClusterAirQualityGroup = {
				name: DeviceClusterName.AIR_QUALITY,
				icon: getClusterIconName(DeviceClusterName.AIR_QUALITY, api),
				mergedClusters: {
					[DeviceClusterName.AIR_QUALITY]: undefined,
					[DeviceClusterName.CARBON_DIOXIDE_CONCENTRATION_MEASUREMENT]: undefined,
					[DeviceClusterName.PM_2_5_CONCENTRATION_MEASUREMENT]: undefined,
					[DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT]: undefined,
					[DeviceClusterName.ILLUMINANCE_MEASUREMENT]: undefined,
					[DeviceClusterName.ON_OFF]: undefined,
					[DeviceClusterName.TEMPERATURE_MEASUREMENT]: undefined,
				},
			};

			// Merge all air quality data from different groups
			for (const group of airQualityGroups) {
				if (group.mergedClusters[DeviceClusterName.AIR_QUALITY]) {
					mergedAirQualityGroup.mergedClusters[DeviceClusterName.AIR_QUALITY] =
						group.mergedClusters[DeviceClusterName.AIR_QUALITY];
				}
				if (
					group.mergedClusters[DeviceClusterName.CARBON_DIOXIDE_CONCENTRATION_MEASUREMENT]
				) {
					mergedAirQualityGroup.mergedClusters[
						DeviceClusterName.CARBON_DIOXIDE_CONCENTRATION_MEASUREMENT
					] =
						group.mergedClusters[
							DeviceClusterName.CARBON_DIOXIDE_CONCENTRATION_MEASUREMENT
						];
				}
				if (group.mergedClusters[DeviceClusterName.PM_2_5_CONCENTRATION_MEASUREMENT]) {
					mergedAirQualityGroup.mergedClusters[
						DeviceClusterName.PM_2_5_CONCENTRATION_MEASUREMENT
					] = group.mergedClusters[DeviceClusterName.PM_2_5_CONCENTRATION_MEASUREMENT];
				}
				if (group.mergedClusters[DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT]) {
					mergedAirQualityGroup.mergedClusters[
						DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT
					] = group.mergedClusters[DeviceClusterName.RELATIVE_HUMIDITY_MEASUREMENT];
				}
				if (group.mergedClusters[DeviceClusterName.ILLUMINANCE_MEASUREMENT]) {
					mergedAirQualityGroup.mergedClusters[
						DeviceClusterName.ILLUMINANCE_MEASUREMENT
					] = group.mergedClusters[DeviceClusterName.ILLUMINANCE_MEASUREMENT];
				}
				if (group.mergedClusters[DeviceClusterName.ON_OFF]) {
					mergedAirQualityGroup.mergedClusters[DeviceClusterName.ON_OFF] =
						group.mergedClusters[DeviceClusterName.ON_OFF];
				}
				if (group.mergedClusters[DeviceClusterName.TEMPERATURE_MEASUREMENT]) {
					mergedAirQualityGroup.mergedClusters[
						DeviceClusterName.TEMPERATURE_MEASUREMENT
					] = group.mergedClusters[DeviceClusterName.TEMPERATURE_MEASUREMENT];
				}
			}

			// Update otherClusters to include the merged group
			const finalOtherClusters = mergedAllClusters.filter(
				(c) => !(c.name === DeviceClusterName.AIR_QUALITY && 'mergedClusters' in c)
			);
			mergedAllClusters = [...finalOtherClusters, mergedAirQualityGroup];
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
				customIcon: storedDevice?.customIcon,
				...endpointResponse,
				name: storedDevice?.name ?? endpointResponse.name,
				managementUrl: await device.getManagementUrl(),
				position: storedDevice?.position,
				status: device.getDeviceStatus(),
			};
			responseDevices.push(responseDevice);
		})
	);

	// Add offline devices
	const onlineDeviceIds = new Set(devices.map((d) => d.getUniqueId()));
	for (const [deviceId, storedDevice] of Object.entries(storedDevices)) {
		if (storedDevice.status === 'offline' && !onlineDeviceIds.has(deviceId)) {
			const room = storedDevice.room;
			const roomInfo = room ? rooms[room] : undefined;
			const clusterNames = storedDevice.clusterNames ?? [];

			// Create minimal cluster representations for offline devices
			const offlineClusters: DashboardDeviceClusterWithState[] = await Promise.all(
				clusterNames.map((clusterName) =>
					getClusterState(api, null, clusterName, deviceId, modules)
				)
			);

			// Get source info from stored device or default to unknown
			const sourceName = storedDevice.source ?? 'unknown';
			const getSourceEmoji = (name: string): string => {
				switch (name) {
					case 'matter':
						return '⚛️';
					case 'ewelink':
						return '🔗';
					case 'wled':
						return '💡';
					case 'led-art':
						return '🔷';
					case 'homewizard':
						return '⚡';
					case 'tuya':
						return '🌐';
					default:
						return '❓';
				}
			};

			const offlineDevice: DashboardDeviceResponse = {
				uniqueId: deviceId,
				name: storedDevice.name ?? `Device ${deviceId}`,
				source: {
					name: sourceName as never,
					emoji: getSourceEmoji(sourceName),
				},
				childClusters: offlineClusters,
				endpoints: [],
				mergedAllClusters: offlineClusters,
				flatAllClusters: offlineClusters,
				room: room,
				roomColor: roomInfo?.color,
				roomIcon: roomInfo?.icon,
				customIcon: storedDevice.customIcon,
				position: storedDevice.position,
				status: 'offline',
			};
			responseDevices.push(offlineDevice);
		}
	}

	return responseDevices;
}

export type DeviceListWithValuesResponse = Awaited<ReturnType<typeof listDevicesWithValues>>;

function getClusterIconName(
	clusterName: DeviceClusterName,
	api?: DeviceAPI
): IncludedIconNames | undefined {
	// Check for override first
	if (api) {
		const override = api.getClusterIconOverride(clusterName);
		if (override) {
			return override;
		}
	}

	// Fall back to default icon mapping
	switch (clusterName) {
		case DeviceClusterName.ON_OFF:
			return 'Lightbulb';
		case DeviceClusterName.DOOR_LOCK:
			return 'Lock';
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
		case DeviceClusterName.CARBON_DIOXIDE_CONCENTRATION_MEASUREMENT:
			return 'Air';
		case DeviceClusterName.AIR_QUALITY:
			return 'Air';
		case DeviceClusterName.PM_2_5_CONCENTRATION_MEASUREMENT:
			return 'Air';
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
