import infoScreenHtml from '../../../client/info-screen/index.html';
import { serveStatic } from '../../lib/serve-static';
import { CLIENT_FOLDER } from '../../lib/constants';
import { authCode, getEvents } from './calendar';
import { ExternalWeatherTimePeriod } from './types';
import { logTag } from '../../lib/logging/logger';
import { createRoutes } from '../../lib/routes';
import { get } from './temperature/external';
import type { ModuleConfig } from '..';
import type { BunRequest } from 'bun';
import { InfoScreen } from '.';
import * as path from 'path';
import * as z from 'zod';

export async function initRouting(moduleConfig: ModuleConfig): Promise<void> {
	const { config } = moduleConfig;

	Bun.serve({
		routes: createRoutes({
			'/': infoScreenHtml,
			...(await serveStatic(
				path.join(CLIENT_FOLDER, 'info-screen'),
				'info-screen'
			)),
			'/authorize': async (req: BunRequest) => {
				const getParams = new URL(req.url).searchParams;
				const code = getParams.get('code');
				if (code) {
					await authCode(code);
				}

				return Response.redirect('/');
			},
			'/weather': async (req) => {
				const { type, period } = z
					.object({
						type: z.enum(['inside', 'outside', 'server']),
						period: z.enum(['current', 'daily']).optional(),
					})
					.parse(await req.json());
				const response = await (async () => {
					if (type === 'inside') {
						// Use temperature module
						const temp = await (
							await InfoScreen.modules
						).temperature.getTemp('room');
						return { temperature: temp, icon: 'inside.png' };
					} else if (type === 'server') {
						const temp = await (
							await InfoScreen.modules
						).temperature.getTemp('server');
						return { temperature: temp, icon: 'server.png' };
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

				return Response.json({
					...response,
					temperature: `${Math.round(temperature * 10) / 10}°`,
				});
			},
			'/calendar': async () => {
				try {
					const events = await getEvents(7);
					return Response.json({ events });
				} catch (e) {
					return Response.json(
						{ error: 'calendar API not authenticated' },
						{ status: 500 }
					);
				}
			},
		}),
		port: config.ports.info,
	});

	logTag(
		'info-screen',
		'magenta',
		`server listening on port ${config.ports.info}`
	);
}
