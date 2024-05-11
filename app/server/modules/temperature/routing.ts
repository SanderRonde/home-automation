import { getController } from './temp-controller';
import { attachMessage } from '../../lib/logger';
import { ModuleConfig, Temperature } from '..';
import { createRouter } from '../../lib/api';
import { APIHandler } from './api';

export function initRouting(
	api: APIHandler,
	{ app, sqlDB }: ModuleConfig<typeof Temperature>
): void {
	const router = createRouter(Temperature, api);
	router.post('/target/:target?', 'setTargetTemp');
	router.post('/mode/:mode?', 'setMode');
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

		attachMessage(
			res,
			`Reported temperature: "${controller.getLastTemp()}`
		);
		res.status(200);
		res.end();
	});

	app.post('/temperature/advise/:name', async (req, res) => {
		const body = {
			...req.params,
			...req.body,
			...req.query,
		} as {
			name: string;
		};

		const controller = await getController(sqlDB, body['name']);

		const advice = controller.getHeaterState();
		attachMessage(
			attachMessage(
				res,
				`Returning advice: "${advice}" for temp ${controller.getLastTemp()}°`
			),
			`Heater mode: "${controller.getMode()}, target: ${controller.getTarget()}`
		);
		res.write(`${advice} ${controller.getMode()}`);
		res.status(200);
		res.end();
	});

	app.post('/temperature/moves/:name', async (req, res) => {
		const body = {
			...req.params,
			...req.body,
			...req.query,
		} as {
			name: string;
		};

		const controller = await getController(sqlDB, body['name']);

		const move = controller.getMove();
		if (!move) {
			attachMessage(res, `Returning no move for controller ${body.name}`);
			res.write('0 l');
		} else {
			attachMessage(
				res,
				`Returning move ${move.ms}ms in direction ${move.direction} for controller ${body['name']}`
			);
			res.write(`${move.ms} ${move.direction === 'left' ? 'l' : 'r'}`);
		}
		res.status(200);
		res.end();
	});

	router.use(app);
}
