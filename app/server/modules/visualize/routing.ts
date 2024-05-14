import { createRouter } from '../../lib/api';
import { ModuleConfig, Visualize } from '..';
import { WebPageHandler } from './web-page';
import { APIHandler } from './api';

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
