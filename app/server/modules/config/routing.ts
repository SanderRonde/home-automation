import { createRouter } from '../../lib/api';
import { WebPageHandler } from './web-page';
import type { APIHandler } from './api';
import type { ModuleConfig } from '..';
import { Config } from '.';

export function initRouting({
	app,
	randomNum,
	apiHandler,
}: ModuleConfig<typeof Config> & { apiHandler: APIHandler }): void {
	const webpageHandler = new WebPageHandler({ randomNum });

	const router = createRouter(Config, apiHandler);
	router.all('/', (req, res) => {
		webpageHandler.index(res, req);
	});
	router.get('/getDevices', 'getDevices');
	router.post('/pairDevice', 'pairDevice');
	router.use(app);
}
