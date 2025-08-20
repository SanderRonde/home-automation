import { createRouter } from '../../lib/api';
import { WebPageHandler } from './web-page';
import type { APIHandler } from './api';
import type { ModuleConfig } from '..';
import { KeyVal } from '.';

export function initRouting({
	app,
	db,
	randomNum,
	apiHandler,
}: ModuleConfig<typeof KeyVal> & { apiHandler: APIHandler }): void {
	const webpageHandler = new WebPageHandler({ randomNum, db });

	const router = createRouter(KeyVal, apiHandler);

	// New API endpoints
	router.get('/config', 'getConfig');
	router.get('/config/raw', 'getConfigRaw');
	router.post('/config', 'setConfig');
	router.post('/device/toggle', 'toggleDevice');
	router.post('/device/set', 'setDevice');

	router.all('/', async (req, res) => {
		await webpageHandler.index(res, req);
	});
	router.use(app);
}
