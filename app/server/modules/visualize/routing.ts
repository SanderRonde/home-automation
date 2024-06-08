import { createRouter } from '../../lib/api';
import { WebPageHandler } from './web-page';
import type { ModuleConfig } from '..';
import { APIHandler } from './api';
import { Visualize } from '..';

export function initRouting({
	app,
	randomNum,
	sqlDB,
}: ModuleConfig<typeof Visualize>): void {
	const apiHandler = new APIHandler({ db: sqlDB });
	const webpageHandler = new WebPageHandler({ randomNum });

	const router = createRouter(Visualize, apiHandler);
	router.get('/data', 'data');
	router.all('/', (req, res) => {
		webpageHandler.index(res, req);
	});
	router.use(app);
}
