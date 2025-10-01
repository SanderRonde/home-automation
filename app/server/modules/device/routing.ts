/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-duplicate-type-constituents */
import {
	DeviceOnOffCluster,
	DeviceClusterName,
	DeviceWindowCoveringCluster,
} from './cluster';
import type {
	BrandedRouteHandlerResponse,
	ServeOptions,
} from '../../lib/routes';
import { createServeOptions, withRequestBody } from '../../lib/routes';
import type { Cluster, ClusterNameLiteral } from './cluster';
import type * as Icons from '@mui/icons-material';
import type { DeviceEndpoint } from './device';
import type { DeviceAPI } from './api';
import type { ModuleConfig } from '..';
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

export type DashboardDeviceClusterExtra = {
	OnOff: { isOn: boolean };
	WindowCovering: {
		targetPositionLiftPercentage: number;
	};
};

export type DashboardDeviceClusterWithState = {
	name: ClusterNameLiteral;
	icon?: keyof typeof Icons;
} & DashboardDeviceClusterExtra[keyof DashboardDeviceClusterExtra];

interface DashboardDeviceEndpointResponse {
	clusters: DashboardDeviceClusterWithState[];
	endpoints: DashboardDeviceEndpointResponse[];
}

interface DashboardDeviceResponse extends DashboardDeviceEndpointResponse {
	uniqueId: string;
	name: string;
	source: {
		name: string;
		emoji: string;
	};
	allClusters: DashboardDeviceClusterWithState[];
	room?: string;
	roomColor?: string;
	roomIcon?: keyof typeof Icons;
}

function _initRouting({ db, modules }: ModuleConfig, api: DeviceAPI) {
	const getClusterState = async (
		cluster: Cluster
	): Promise<DashboardDeviceClusterWithState> => {
		const clusterName = cluster.getName();
		const base = {
			name: clusterName.value,
			icon: getClusterIconName(clusterName),
		};
		if (cluster instanceof DeviceOnOffCluster) {
			return {
				...base,
				isOn: await cluster.isOn.get(),
			};
		}
		if (cluster instanceof DeviceWindowCoveringCluster) {
			return {
				...base,
				targetPositionLiftPercentage:
					await cluster.targetPositionLiftPercentage.get(),
			};
		}
		return base as DashboardDeviceClusterWithState;
	};

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
				const devices: DeviceInfo[] = Object.values(knownDevices).map(
					(device) => ({
						...device,
						status: currentDeviceIds.includes(device.id)
							? 'online'
							: 'offline',
					})
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
				const deviceApi = await modules.device.api.value;
				const devices = [
					...Object.values(await deviceApi.devices.get()),
				];
				const storedDevices = deviceApi.getStoredDevices();
				const rooms = deviceApi.getRooms();
				const responseDevices: DashboardDeviceResponse[] = [];

				const clusterStateCache = new WeakMap<
					Cluster,
					DashboardDeviceClusterWithState
				>();
				const _getClusterState = async (
					cluster: Cluster
				): Promise<DashboardDeviceClusterWithState> => {
					if (clusterStateCache.has(cluster)) {
						return clusterStateCache.get(cluster)!;
					}
					return await getClusterState(cluster);
				};

				const getResponseForEndpoint = async (
					endpoint: DeviceEndpoint
				): Promise<DashboardDeviceEndpointResponse> => {
					const endpoints = [];
					const clusters = [];

					for (const cluster of endpoint.clusters) {
						const clusterState = await _getClusterState(cluster);
						clusters.push(clusterState);
					}

					for (const subEndpoint of endpoint.endpoints) {
						const endpointResponse =
							await getResponseForEndpoint(subEndpoint);
						endpoints.push(endpointResponse);
					}

					return {
						clusters,
						endpoints,
					};
				};

				for (const device of devices) {
					const deviceId = device.getUniqueId();
					const storedDevice = storedDevices[deviceId];
					const room = storedDevice?.room;
					const roomInfo = room ? rooms[room] : undefined;

					const allClusters = [];
					for (const cluster of device.allClusters) {
						const clusterState = await _getClusterState(cluster);
						allClusters.push(clusterState);
					}

					const endpointResponse =
						await getResponseForEndpoint(device);

					const responseDevice: DashboardDeviceResponse = {
						uniqueId: deviceId,
						name: storedDevice?.name ?? device.getDeviceName(),
						source: {
							name: device.getSource().value,
							emoji: device.getSource().toEmoji(),
						},
						allClusters,
						room: room,
						roomColor: roomInfo?.color,
						roomIcon: roomInfo?.icon,
						...endpointResponse,
					};
					responseDevices.push(responseDevice);
				}

				return json({
					devices: responseDevices,
				});
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

					if (
						api.updateDeviceRoom(
							deviceId,
							room,
							icon as keyof typeof Icons
						)
					) {
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
					deviceId: z.string(),
					isOn: z.boolean(),
				}),
				async (body, _req, _server, res) =>
					performActionForDeviceCluster(
						api,
						res,
						body.deviceId,
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
					deviceId: z.string(),
					targetPositionLiftPercentage: z.number(),
				}),
				async (body, _req, _server, res) =>
					performActionForDeviceCluster(
						api,
						res,
						body.deviceId,
						DeviceWindowCoveringCluster,
						async (cluster) => {
							await Promise.all([
								new Promise<void>((resolve) => {
									const callback = (
										value: number | undefined
									) => {
										if (
											value ===
											body.targetPositionLiftPercentage
										) {
											resolve();
										}
									};
									cluster.targetPositionLiftPercentage.subscribe(
										callback
									);
								}),
								void cluster.goToLiftPercentage({
									percentage:
										body.targetPositionLiftPercentage,
								}),
							]);
						}
					)
			),
		},
		true
	);
}

function getClusterIconName(
	clusterName: DeviceClusterName
): keyof typeof Icons | undefined {
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
	deviceId: string,
	clusterType: C,
	callback: (cluster: InstanceType<C>) => Promise<void>
) {
	const device = api.devices.current()[deviceId];
	if (!device) {
		return res.error({ error: 'Device not found' }, 404);
	}
	const cluster = device.getClusterByType(clusterType);
	if (!cluster) {
		return res.error({ error: 'Cluster not found' }, 404);
	}
	const success = await Promise.race([
		callback(cluster).then(() => true),
		wait(10000).then(() => false),
	]);
	if (!success) {
		return res.error({ error: 'Cluster operation timed out' }, 500);
	}
	return res.json({ success: true });
}

function validateClusterRoute<T extends `/cluster/${ClusterNameLiteral}`>(
	route: T
): T {
	return route;
}

export const initRouting = _initRouting as (
	config: ModuleConfig,
	api: DeviceAPI
) => ServeOptions<unknown>;

export type DeviceRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
