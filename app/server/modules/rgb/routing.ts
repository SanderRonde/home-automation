import { RGB } from '.';
import { ModuleConfig } from '..';
import { createRouter } from '../../lib/api';
import { APIHandler } from './api';
import { scanRGBControllers } from './scan';
import { WebPageHandler } from './web-page';

export function initRouting({ app, randomNum }: ModuleConfig): void {
	const router = createRouter(RGB, APIHandler);
	router.post('/color', 'setColor');
	router.post('/color/:color/:instensity?', 'setColor');
	router.post('/color/:red/:green/:blue/:intensity?', 'setRGB');
	router.post('/power/:power', 'setPower');
	router.post('/effect/:effect', 'runEffect');
	router.all('/refresh', 'refresh');
	router.all('', (req, res) => {
		WebPageHandler.index(res, req, randomNum);
	});
	router.use(app);

	app.post('/scan', async (_req, res) => {
		await scanRGBControllers();
		res.status(200).end();
	});
}
