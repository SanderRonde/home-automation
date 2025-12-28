import { createServeOptions, staticResponse } from '../../lib/routes';
import dashboardHtml from '../../../client/dashboard/index.html';
import { CLIENT_FOLDER, ROOT } from '../../lib/constants';
import { serveStatic } from '../../lib/serve-static';
import type { ServeOptions } from '../../lib/routes';
import { logDev } from '../../lib/logging/log-dev';
import type { ModuleConfig } from '..';
import path from 'path';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const BUILD_FOLDER = path.join(ROOT, 'build/client/dashboard');

async function _initRouting({ modules, wsPublish }: ModuleConfig) {
	const activeDiscoveries = new Set<number>();

	return createServeOptions(
		{
			'/favicon.ico': staticResponse(
				new Response(Bun.file(path.join(CLIENT_FOLDER, 'dashboard/static', 'favicon.ico')))
			),
			'/pair/:code': async (req, _server, { json }) => {
				const matterClient = await modules.matter.server.value;
				const pairedDevices = await matterClient.commission(req.params.code);
				return json(pairedDevices.length);
			},
			...(IS_PRODUCTION
				? {
						// Serve all JS files from build folder (with glob pattern handled by serveStatic)
						'/': staticResponse(
							new Response(Bun.file(path.join(BUILD_FOLDER, 'index.html')))
						),
						...(await serveStatic(BUILD_FOLDER)),
					}
				: {
						'/': dashboardHtml,
						...(await serveStatic(
							path.join(CLIENT_FOLDER, 'dashboard'),
							'app/client/dashboard'
						)),
					}),
		},
		true,
		{
			open: async () => {},
			message: async (_ws, message) => {
				const parsedMessage = JSON.parse(
					message.toString()
				) as DashboardWebsocketClientMessage;
				if (parsedMessage.type === 'startDiscovery') {
					const matterClient = await modules.matter.server.value;
					const discoveryId = Math.random();
					activeDiscoveries.add(discoveryId);
					await wsPublish(
						JSON.stringify({
							type: 'startDiscovery',
						} satisfies DashboardWebsocketServerMessage)
					);
					await matterClient.discoverCommissionableDevices((device) => {
						logDev(device);
						void wsPublish(
							JSON.stringify({
								type: 'commissionableDevices',
								device: {
									id: device.deviceIdentifier,
									discriminator: device.D,
								},
							} satisfies DashboardWebsocketServerMessage)
						);
					});
					activeDiscoveries.delete(discoveryId);
					if (activeDiscoveries.size === 0) {
						await wsPublish(
							JSON.stringify({
								type: 'endDiscovery',
							} satisfies DashboardWebsocketServerMessage)
						);
					}
				}
			},
		}
	);
}

export type DashboardWebsocketServerMessage =
	| {
			type: 'startDiscovery';
	  }
	| {
			type: 'endDiscovery';
	  }
	| {
			type: 'commissionableDevices';
			device: {
				id: string;
				discriminator: number;
			};
	  };

export type DashboardWebsocketClientMessage = {
	type: 'startDiscovery';
};

export type DashboardRoutes =
	Awaited<ReturnType<typeof _initRouting>> extends ServeOptions<infer R> ? R : never;

export const initRouting = _initRouting as (config: ModuleConfig) => Promise<ServeOptions<unknown>>;
