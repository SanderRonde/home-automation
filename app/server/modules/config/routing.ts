import { createRouter } from '../../lib/api';
import { WebPageHandler } from './web-page';
import type { ModuleConfig } from '..';
import { Config } from '.';

export function initRouting({
	app,
	randomNum,
}: ModuleConfig<typeof Config>): void {
	const webpageHandler = new WebPageHandler({ randomNum });

	const router = createRouter(Config, {});
	router.all('/', (req, res) => {
		webpageHandler.index(res, req);
	});
	router.use(app);
}

// TODO:(sander) HIERZO
// Appears to not pair hue anymore.
// Add pair button in web UI