import { createRouter } from '@server/lib/api';
import { WebPageHandler } from '@server/modules/rgb/web-page';
import { scanRGBControllers } from '@server/modules/rgb/scan';
import { APIHandler } from '@server/modules/rgb/api';
import { ModuleConfig } from '..';
import { RGB } from '.';

export function initRouting({
	app,
	randomNum,
}: ModuleConfig<typeof RGB>): void {
	const router = createRouter(RGB, APIHandler);
	router.post('/color', 'setColor');
	router.post('/color/:color/:instensity?', 'setColor');
	router.post('/color/:red/:green/:blue/:intensity?', 'setRGB');
	router.post('/power/:power', 'setPower');
	router.post('/effect/:effect', 'runEffect');
	router.all('/refresh', 'refresh');
	router.all('', async (req, res) => {
		await WebPageHandler.index(res, req, randomNum);
	});
	router.use(app);

	app.post('/scan', async (_req, res) => {
		await scanRGBControllers();
		res.status(200).end();
	});
}
