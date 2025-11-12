import { createServeOptions, withRequestBody } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import { LogObj } from '../../lib/logging/lob-obj';
import { getController } from './temp-controller';
import type { ModuleConfig, AllModules } from '..';
import * as z from 'zod';
import { Temperature } from './index';

function _initRouting({ sqlDB, db, modules }: ModuleConfig) {
	return createServeOptions(
		{
			'/report/:name/:temp': async (req, _server, { error, text }) => {
				const temp = parseFloat(req.params.temp);
				if (Number.isNaN(temp) || temp === 0) {
					return error(`Invalid temperature "${req.params.temp}"`, 400);
				}

				// Set last temp
				const controller = await getController(sqlDB, req.params.name);
				await controller.setLastTemp(temp);

				LogObj.fromReqRes(req).attachMessage(
					`Reported temperature: "${controller.getLastTemp()}`
				);
				return text(`Reported temperature: "${controller.getLastTemp()}"`, 200);
			},
			'/getTemp': withRequestBody(
				z.object({ name: z.string() }),
				async (body, req, _server, { json }) => {
					const controller = await getController(sqlDB, body.name);
					LogObj.fromReqRes(req).attachMessage(
						`Getting temp. Returning ${controller.getLastTemp()}`
					);
					return json({
						temp: controller.getLastTemp(),
					});
				}
			),
			'/inside-temperature': async (_req, _server, { json }) => {
				const allModules = modules as AllModules;
				const temp = await Temperature.getInsideTemperature(allModules);
				return json({ success: true, temperature: temp });
			},
			'/temperature-sensors': async (_req, _server, { json }) => {
				const allModules = modules as AllModules;
				const sensors = await Temperature.getAvailableTemperatureSensors(allModules, sqlDB);
				return json({ success: true, ...sensors });
			},
			'/inside-temperature-sensors': {
				GET: (_req, _server, { json }) => {
					const sensors = Temperature.getInsideTemperatureSensors();
					return json({ success: true, sensors });
				},
				POST: withRequestBody(
					z.object({
						sensors: z.array(
							z.union([
								z.string(),
								z.object({
									type: z.literal('device'),
									deviceId: z.string(),
								}),
							])
						),
					}),
					(body, _req, _server, { json }) => {
						db.update((old) => ({
							...old,
							insideTemperatureSensors: body.sensors,
						}));
						return json({ success: true, sensors: body.sensors });
					}
				),
			},
		},
		true
	);
}

export const initRouting = _initRouting as (config: ModuleConfig) => ServeOptions<unknown>;

export type TemperatureRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
