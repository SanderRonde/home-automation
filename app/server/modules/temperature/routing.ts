import { LogObj } from '../../lib/logging/lob-obj';
import { getController } from './temp-controller';
import { createRoutes } from '../../lib/routes';
import type { Routes } from '../../lib/routes';
import type { ModuleConfig } from '..';
import * as z from 'zod';

export function initRouting({ sqlDB }: ModuleConfig): Routes {
	return createRoutes({
		'/report/:name/:temp': async (req) => {
			const temp = parseFloat(req.params.temp);
			if (Number.isNaN(temp) || temp === 0) {
				return new Response(
					`Invalid temperature "${req.params.temp}"`,
					{ status: 400 }
				);
			}

			// Set last temp
			const controller = await getController(sqlDB, req.params.name);
			await controller.setLastTemp(temp);

			LogObj.fromReqRes(req).attachMessage(
				`Reported temperature: "${controller.getLastTemp()}`
			);
			return new Response(
				`Reported temperature: "${controller.getLastTemp()}"`,
				{ status: 200 }
			);
		},
		'/getTemp': async (req) => {
			const body = z
				.object({
					name: z.string(),
				})
				.parse(await req.json());
			const controller = await getController(sqlDB, body.name);
			LogObj.fromReqRes(req).attachMessage(
				`Getting temp. Returning ${controller.getLastTemp()}`
			);
			return new Response(
				JSON.stringify({
					temp: controller.getLastTemp(),
				})
			);
		},
	});
}
