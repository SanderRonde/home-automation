import { createServeOptions, staticResponse } from '../../lib/routes';
import dashboardHtml from '../../../client/dashboard/index.html';
import type { ServeOptions } from '../../lib/routes';
import { CLIENT_FOLDER } from '../../lib/constants';
import type { ModuleConfig } from '..';
import path from 'path';

function _initRouting({ modules }: ModuleConfig) {
	return createServeOptions(
		{
			'/': dashboardHtml,
			'/favicon.ico': staticResponse(
				new Response(Bun.file(path.join(CLIENT_FOLDER, 'dashboard/static', 'favicon.ico')))
			),
			'/pair/:code': async (req, _server, { json }) => {
				const matterClient = await modules.matter.server.value;
				const pairedDevices = await matterClient.commission(req.params.code);
				return json(pairedDevices.length);
			},
		},
		true
	);
}

export type DashboardRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;

export const initRouting = _initRouting as (config: ModuleConfig) => ServeOptions<unknown>;
