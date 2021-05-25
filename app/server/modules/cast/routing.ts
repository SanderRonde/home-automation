import { Cast } from './index';
import { ModuleConfig } from '..';
import { createRouter } from '../../lib/api';
import { ExternalHandler } from './external';
import { APIHandler } from './api';

export async function initRouting({ app }: ModuleConfig): Promise<void> {
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
