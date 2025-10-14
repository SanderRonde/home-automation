/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-duplicate-type-constituents */
import {
	DeviceOnOffCluster,
	DeviceClusterName,
	DeviceWindowCoveringCluster,
	DevicePowerSourceCluster,
	DeviceOccupancySensingCluster,
} from './cluster';
import type { BrandedRouteHandlerResponse, ServeOptions } from '../../lib/routes';
import { createServeOptions, withRequestBody } from '../../lib/routes';
import type { Device, DeviceEndpoint } from './device';
import type { AllModules, ModuleConfig } from '..';
import type * as Icons from '@mui/icons-material';
import type { Cluster } from './cluster';
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
	icon?: keyof typeof Icons;
}

type DashboardDeviceClusterBase = {
	name: DeviceClusterName;
	icon?: keyof typeof Icons;
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

export type DashboardDeviceClusterWithState = DashboardDeviceClusterBase &
	(
		| DashboardDeviceClusterOnOff
		| DashboardDeviceClusterWindowCovering
		| DashboardDeviceClusterPowerSource
		| DashboardDeviceClusterOccupancySensing
	);

interface DashboardDeviceEndpointResponse {
	name: string;
	childClusters: DashboardDeviceClusterWithState[];
	endpoints: DashboardDeviceEndpointResponse[];
	allClusters: DashboardDeviceClusterWithState[];
}

interface DashboardDeviceResponse extends DashboardDeviceEndpointResponse {
	uniqueId: string;
	name: string;
	source: {
		name: string;
		emoji: string;
	};
	childClusters: DashboardDeviceClusterWithState[];
	room?: string;
	roomColor?: string;
	roomIcon?: keyof typeof Icons;
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
				const devices: DeviceInfo[] = Object.values(knownDevices).map((device) => ({
					...device,
					status: currentDeviceIds.includes(device.id) ? 'online' : 'offline',
				}));

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

					if (api.updateDeviceRoom(deviceId, room, icon as keyof typeof Icons)) {
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
							await Promise.all([
								new Promise<void>((resolve) => {
									const callback = (value: boolean) => {
										if (value === body.isOn) {
											resolve();
										}
									};
									cluster.isOn.subscribe(callback);
								}),
								void cluster.setOn(body.isOn),
							]);
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
							await Promise.all([
								new Promise<void>((resolve) => {
									const callback = (value: number | undefined) => {
										if (value === body.targetPositionLiftPercentage) {
											resolve();
										}
									};
									cluster.targetPositionLiftPercentage.subscribe(callback);
								}),
								void cluster.goToLiftPercentage({
									percentage: body.targetPositionLiftPercentage,
								}),
							]);
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
					icon: z.string() as z.ZodType<keyof typeof Icons>,
					actions: z.array(
						z.union([
							z.object({
								deviceId: z.string(),
								cluster: z.literal(DeviceClusterName.ON_OFF),
								action: z.object({
									isOn: z.boolean(),
								}),
							}),
							z.object({
								deviceId: z.string(),
								cluster: z.literal(DeviceClusterName.WINDOW_COVERING),
								action: z.object({
									targetPositionLiftPercentage: z.number(),
								}),
							}),
						])
					),
					trigger: z
						.object({
							type: z.literal('occupancy'),
							deviceId: z.string(),
						})
						.optional(),
				}),
				(body, _req, _server, { json }) => {
					const sceneId = api.sceneAPI.createScene(body);
					return json({ success: true, sceneId });
				}
			),
			'/scenes/:sceneId/update': withRequestBody(
				z.object({
					title: z.string(),
					icon: z.string() as z.ZodType<keyof typeof Icons>,
					actions: z.array(
						z.union([
							z.object({
								deviceId: z.string(),
								cluster: z.literal(DeviceClusterName.ON_OFF),
								action: z.object({
									isOn: z.boolean(),
								}),
							}),
							z.object({
								deviceId: z.string(),
								cluster: z.literal(DeviceClusterName.WINDOW_COVERING),
								action: z.object({
									targetPositionLiftPercentage: z.number(),
								}),
							}),
						])
					),
					trigger: z
						.object({
							type: z.literal('occupancy'),
							deviceId: z.string(),
						})
						.optional(),
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
	cluster: Cluster,
	deviceId: string
): Promise<DashboardDeviceClusterWithState> => {
	const clusterName = cluster.getName();
	if (cluster instanceof DeviceOnOffCluster && clusterName === DeviceClusterName.ON_OFF) {
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName),
			isOn: await cluster.isOn.get(),
		};
	}
	if (
		cluster instanceof DeviceWindowCoveringCluster &&
		clusterName === DeviceClusterName.WINDOW_COVERING
	) {
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName),
			targetPositionLiftPercentage: await cluster.targetPositionLiftPercentage.get(),
		};
	}
	if (
		cluster instanceof DevicePowerSourceCluster &&
		clusterName === DeviceClusterName.POWER_SOURCE
	) {
		const batteryLevel = await cluster.batteryChargeLevel.get();
		if (batteryLevel !== null) {
			return {
				name: clusterName,
				icon: getClusterIconName(clusterName),
				batteryPercentage: batteryLevel,
			};
		}
	}
	if (
		cluster instanceof DeviceOccupancySensingCluster &&
		clusterName === DeviceClusterName.OCCUPANCY_SENSING
	) {
		const occupied = await cluster.occupancy.get();
		const lastEvent = await api.occupancyTracker.getLastTriggered(deviceId);
		return {
			name: clusterName,
			icon: getClusterIconName(clusterName),
			occupied,
			lastTriggered: lastEvent?.timestamp,
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

	const _getClusters = async (cluster: Cluster, deviceId: string) => {
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

		for (const cluster of endpoint.clusters) {
			clusters.push(await _getClusters(cluster, deviceId));
		}

		for (const cluster of endpoint.allClusters) {
			allClusters.push(await _getClusters(cluster, deviceId));
		}

		for (const subEndpoint of endpoint.endpoints) {
			const endpointResponse = await getResponseForEndpoint(subEndpoint, deviceId);
			endpoints.push(endpointResponse);
		}

		return {
			name: await endpoint.getDeviceName(),
			childClusters: clusters,
			endpoints,
			allClusters,
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
			};
			responseDevices.push(responseDevice);
		})
	);

	return responseDevices;
}

export type DeviceListWithValuesResponse = Awaited<ReturnType<typeof listDevicesWithValues>>;

function getClusterIconName(clusterName: DeviceClusterName): keyof typeof Icons | undefined {
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
	const clusters = devices.map((d) => d.getClusterByType(clusterType));
	if (clusters.some((c) => !c)) {
		return res.error({ error: 'Cluster not found' }, 404);
	}
	const success = await Promise.race([
		Promise.all((clusters as InstanceType<C>[]).map((c) => callback(c))).then(() => true),
		wait(10000).then(() => false),
	]);
	if (!success) {
		return res.error({ error: 'Cluster operation timed out' }, 500);
	}
	return res.json({ success: true });
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
