import { CLIENT_FOLDER } from '../../lib/constants';
import { createRouter } from '../../lib/api';
import { WebPageHandler } from './web-page';
import type { APIHandler } from './api';
import type { ModuleConfig } from '..';
import { Config } from '.';
import path from 'path';

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
	router.get('/favicon.ico', (_, res) => {
		res.sendFile(path.join(CLIENT_FOLDER, 'config/static', 'favicon.ico'));
	});
	router.get('/getDevices', 'getDevices');
	router.post('/pairDevice', 'pairDevice');
	router.use(app);
}
