import type { DeviceEndpoint } from '../device/device';
import { CLIENT_FOLDER } from '../../lib/constants';
import { createRoutes } from '../../lib/routes';
import type { Routes } from '../../lib/routes';
import { configHTML } from './web-page';
import type { ModuleConfig } from '..';
import { auth } from '../../lib/auth';
import path from 'path';

export interface ConfigDeviceEndpointResponse {
	clusters: {
		name: string;
		emoji: string;
	}[];
	endpoints: ConfigDeviceEndpointResponse[];
}

interface ConfigDeviceResponse extends ConfigDeviceEndpointResponse {
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
}

export interface ConfigGetDevicesResponse {
	devices: ConfigDeviceResponse[];
}

export interface ConfigPairDeviceResponse {
	devices: string[];
}

export function initRouting({ modules }: ModuleConfig): Routes {
	return createRoutes({
		'/': new Response(configHTML()),
		'/favicon.ico': new Response(
			Bun.file(path.join(CLIENT_FOLDER, 'config/static', 'favicon.ico'))
		),
		'/getDevices': async (req) => {
			if (!auth(req)) {
				return new Response('Unauthorized', { status: 401 });
			}
			const devices = (await modules.device.api.value).getDevices();
			const responseDevices: ConfigDeviceResponse[] = [];

			const getResponseForEndpoint = (
				endpoint: DeviceEndpoint
			): ConfigDeviceEndpointResponse => {
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
				const responseDevice: ConfigDeviceResponse = {
					uniqueId: device.getUniqueId(),
					name: device.getDeviceName(),
					source: {
						name: device.getSource().value,
						emoji: device.getSource().toEmoji(),
					},
					allClusters: device.allClusters.map((cluster) => ({
						name: cluster.getName().value,
						emoji: cluster.getName().toEmoji(),
					})),
					...getResponseForEndpoint(device),
				};
				responseDevices.push(responseDevice);
			}
			return Response.json({
				devices: responseDevices,
			});
		},
		'/pair/:code': async (req) => {
			if (!auth(req)) {
				return new Response('Unauthorized', { status: 401 });
			}
			const matterClient = await modules.matter.client.value;
			const pairedDevices = await matterClient.pair(req.params.code);
			return Response.json({
				devices: pairedDevices,
			} satisfies ConfigPairDeviceResponse);
		},
	});
}
