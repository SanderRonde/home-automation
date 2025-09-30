import { createServeOptions, staticResponse } from '../../lib/routes';
import dashboardHtml from '../../../client/dashboard/index.html';
import type { DeviceEndpoint } from '../device/device';
import type { ServeOptions } from '../../lib/routes';
import { CLIENT_FOLDER } from '../../lib/constants';
import type { ModuleConfig } from '..';
import path from 'path';

interface DashboardDeviceEndpointResponse {
	clusters: {
		name: string;
		emoji: string;
	}[];
	endpoints: DashboardDeviceEndpointResponse[];
}

interface DashboardDeviceResponse extends DashboardDeviceEndpointResponse {
	uniqueId: string;
	name: string;
	source: {
		name: string;
		emoji: string;
	};
	allClusters: {
		name: string;
		emoji: string;
	}[];
	room?: string;
	roomColor?: string;
	roomIcon?: string;
}

interface DashboardPairDeviceResponse {
	devices: string[];
}

function _initRouting({ modules }: ModuleConfig) {
	return createServeOptions(
		{
			'/': dashboardHtml,
			'/favicon.ico': staticResponse(
				new Response(
					Bun.file(
						path.join(
							CLIENT_FOLDER,
							'dashboard/static',
							'favicon.ico'
						)
					)
				)
			),
			'/getDevices': async (_req, _server, { json }) => {
				const devices = [
					...Object.values(
						await (await modules.device.api.value).devices.get()
					),
				];
				const deviceApi = await modules.device.api.value;
				const storedDevices = deviceApi.getStoredDevices();
				const rooms = deviceApi.getRooms();
				const responseDevices: DashboardDeviceResponse[] = [];

				const getResponseForEndpoint = (
					endpoint: DeviceEndpoint
				): DashboardDeviceEndpointResponse => {
					const endpoints = [];
					const clusters = [];
					for (const cluster of endpoint.clusters) {
						clusters.push({
							name: cluster.getName().value,
							emoji: cluster.getName().toEmoji(),
						});
					}
					for (const subEndpoint of endpoint.endpoints) {
						endpoints.push(getResponseForEndpoint(subEndpoint));
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

					const responseDevice: DashboardDeviceResponse = {
						uniqueId: deviceId,
						name: storedDevice?.name ?? device.getDeviceName(),
						source: {
							name: device.getSource().value,
							emoji: device.getSource().toEmoji(),
						},
						allClusters: device.allClusters.map((cluster) => ({
							name: cluster.getName().value,
							emoji: cluster.getName().toEmoji(),
						})),
						room: room,
						roomColor: roomInfo?.color,
						roomIcon: roomInfo?.icon,
						...getResponseForEndpoint(device),
					};
					responseDevices.push(responseDevice);
				}
				return json({
					devices: responseDevices,
				});
			},
			'/pair/:code': async (req, _server, { json }) => {
				const matterClient = await modules.matter.client.value;
				const pairedDevices = await matterClient.pair(req.params.code);
				return json({
					devices: pairedDevices,
				} satisfies DashboardPairDeviceResponse);
			},
		},
		true
	);
}

export type DashboardRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;

export const initRouting = _initRouting as (
	config: ModuleConfig
) => ServeOptions<unknown>;
