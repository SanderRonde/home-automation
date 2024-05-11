import { createRouter } from '@server/lib/api';
import { ExternalHandler } from '@server/modules/cast/external';
import { APIHandler } from '@server/modules/cast/api';
import { ModuleConfig } from '..';
import { Cast } from '@server/modules/cast/index';

export async function initRouting({
	app,
}: ModuleConfig<typeof Cast>): Promise<void> {
	await ExternalHandler.init();

	const router = createRouter(Cast, APIHandler);
	router.get('/:auth/stop', 'stop');
	router.post('/stop', 'stop');
	router.get('/:auth/cast/:url', 'url');
	router.post('/cast/:url?', 'url');
	router.get('/:auth/say/:text/:lang?', 'say');
	router.post('/say/:text?/:lang?', 'say');
	router.post('/pasta/:pasta?', 'pasta');
	router.use(app);
}
