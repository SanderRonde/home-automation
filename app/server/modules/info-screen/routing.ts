import { createServeOptions, staticResponse, withRequestBody } from '../../lib/routes';
import { authCode, authenticateURL, getEvents, getCalendar } from './calendar';
import infoScreenHtml from '../../../client/info-screen/index.html';
import { serveStatic } from '../../lib/serve-static';
import { CLIENT_FOLDER } from '../../lib/constants';
import { ExternalWeatherTimePeriod } from './types';
import type { AllModules, ModuleConfig } from '..';
import { logTag } from '../../lib/logging/logger';
import { get } from './temperature/external';
import type { BunRequest } from 'bun';
import { InfoScreen } from '.';
import * as path from 'path';
import * as z from 'zod';

export async function initRouting(moduleConfig: ModuleConfig): Promise<void> {
	const { config } = moduleConfig;

	Bun.serve({
		routes: createServeOptions(
			{
				'/': infoScreenHtml,
				...(await serveStatic(path.join(CLIENT_FOLDER, 'info-screen'), 'info-screen')),
				'/authorize': async (req: BunRequest) => {
					const getParams = new URL(req.url).searchParams;
					const code = getParams.get('code');
					if (code) {
						await authCode(code);
					}

					return staticResponse(Response.redirect('/'));
				},
				'/weather': withRequestBody(
					z.object({
						type: z.enum(['inside', 'outside', 'server']),
						period: z.enum(['current', 'daily']).optional(),
					}),
					async (body, _req, _server, { json }) => {
						const { type, period } = body;
						const response = await (async () => {
							if (type === 'inside') {
								// Use temperature module
								const temp = await (
									await InfoScreen.getModules<AllModules>()
								).temperature.getTemp('room');
								return {
									temperature: temp,
									icon: 'inside.png',
								};
							} else if (type === 'server') {
								const temp = await (
									await InfoScreen.getModules<AllModules>()
								).temperature.getTemp('server');
								return {
									temperature: temp,
									icon: 'server.png',
								};
							} else {
								// Use openweathermap
								const openweathermapResponse = await get(
									period === 'current'
										? ExternalWeatherTimePeriod.CURRENT
										: ExternalWeatherTimePeriod.DAILY
								);
								if (openweathermapResponse === null) {
									return {
										temperature: 0,
										icon: 'questionmark.svg',
									};
								}
								return {
									...openweathermapResponse,
									temperature: openweathermapResponse.temp,
								};
							}
						})();
						const { temperature } = response;

						return json({
							success: true,
							...response,
							temperature: `${Math.round(temperature * 10) / 10}°`,
						});
					}
				),
				'/calendar': async (_req, _server, { json }) => {
					const calendar = getCalendar();
					if (!calendar) {
						return json({
							success: false,
							error: 'Not authenticated',
							redirect: await authenticateURL(),
						});
					}

					const events = await getEvents(calendar, 7);
					return json({ success: true, events });
				},
			},
			false
		).routes,
		port: config.ports.info,
	});

	logTag('info-screen', 'magenta', `server listening on port ${config.ports.info}`);
}
