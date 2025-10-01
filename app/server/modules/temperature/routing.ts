import { createServeOptions, withRequestBody } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import { LogObj } from '../../lib/logging/lob-obj';
import { getController } from './temp-controller';
import type { ModuleConfig } from '..';
import * as z from 'zod';

function _initRouting({ sqlDB }: ModuleConfig) {
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
		},
		true
	);
}

export const initRouting = _initRouting as (config: ModuleConfig) => ServeOptions<unknown>;

export type TemperatureRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
