import { createRouter } from '../../lib/api';
import { WebPageHandler } from './web-page';
import type { ModuleConfig } from '..';
import { Config } from '.';

export function initRouting(
	config: typeof Config,
	{ app, randomNum }: ModuleConfig<typeof Config>
): void {
	const webpageHandler = new WebPageHandler({ randomNum });

	const router = createRouter(Config);
	router.all('/', async (req, res) => {
		await webpageHandler.index(res, req);
	});
	router.use(app);
}
