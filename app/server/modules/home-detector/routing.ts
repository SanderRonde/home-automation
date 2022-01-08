import { createRouter } from '../../lib/api';
import { WebPageHandler } from './web-page';
import { Detector } from './classes';
import { APIHandler } from './api';
import { ModuleConfig } from '..';
import { HomeDetector } from '.';

export function initRouting({
	app,
	apiHandler,
	randomNum,
	detector,
}: ModuleConfig & {
	detector: Detector;
	apiHandler: APIHandler;
}): void {
	const webpageHandler = new WebPageHandler({ randomNum, detector });

	const router = createRouter(HomeDetector, apiHandler);
	router.post('/all', 'getAll');
	router.post('/:name', 'get');
	router.use(app);

	app.all(['/home-detector', '/whoishome', '/whoshome'], async (req, res) => {
		await webpageHandler.index(res, req);
	});
	app.all(
		['/home-detector/e', '/whoishome/e', '/whoshome/e'],
		async (req, res) => {
			await webpageHandler.index(res, req, true);
		}
	);
}
