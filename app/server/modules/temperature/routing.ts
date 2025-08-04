import { LogObj } from '../../lib/logging/lob-obj';
import { getController } from './temp-controller';
import { createRouter } from '../../lib/api';
import type { APIHandler } from './api';
import type { ModuleConfig } from '..';
import { Temperature } from '..';

export function initRouting(
	api: APIHandler,
	{ app, sqlDB }: ModuleConfig<typeof Temperature>
): void {
	const router = createRouter(Temperature, api);
	router.all('/temp', 'getTemp');

	app.post('/temperature/report/:name/:temp?', async (req, res) => {
		const body = {
			...req.params,
			...req.body,
			...req.query,
		} as {
			temp?: string;
			name: string;
		};
		if (!('temp' in body)) {
			res.write('Missing key "temp"');
			res.status(400);
			res.end();
			return;
		}
		if (!('name' in body)) {
			res.write('Missing key "name"');
			res.status(400);
			res.end();
			return;
		}
		const temp = parseFloat(body.temp!);
		if (Number.isNaN(temp) || temp === 0) {
			res.write(`Invalid temperature "${body.temp!}"`);
			res.status(400);
			res.end();
			return;
		}

		// Set last temp
		const controller = await getController(sqlDB, body['name']);
		await controller.setLastTemp(temp);

		LogObj.fromRes(res).attachMessage(
			`Reported temperature: "${controller.getLastTemp()}`
		);
		res.status(200);
		res.end();
	});

	router.use(app);
}
