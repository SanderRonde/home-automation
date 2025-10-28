import { createServeOptions, staticResponse } from '../../lib/routes';
import dashboardHtml from '../../../client/dashboard/index.html';
import { CLIENT_FOLDER, ROOT } from '../../lib/constants';
import { serveStatic } from '../../lib/serve-static';
import type { ServeOptions } from '../../lib/routes';
import type { ModuleConfig } from '..';
import path from 'path';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const BUILD_FOLDER = path.join(ROOT, 'build/client/dashboard');

async function _initRouting({ modules }: ModuleConfig) {
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
						// Bun quirk where it bundles all but the manifest.json...
						'/service-worker.js': async () => {
							await Bun.build({
								entrypoints: [
									path.join(CLIENT_FOLDER, 'dashboard', 'service-worker.ts'),
								],
								outdir: BUILD_FOLDER,
								naming: 'service-worker.js',
							});
							return new Response(
								Bun.file(path.join(BUILD_FOLDER, 'service-worker.js'))
							);
						},
						...(await serveStatic(
							path.join(CLIENT_FOLDER, 'dashboard'),
							'app/client/dashboard'
						)),
					}),
		},
		true
	);
}

export type DashboardRoutes =
	Awaited<ReturnType<typeof _initRouting>> extends ServeOptions<infer R> ? R : never;

export const initRouting = _initRouting as (config: ModuleConfig) => Promise<ServeOptions<unknown>>;
