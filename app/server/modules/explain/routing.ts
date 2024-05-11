import { createRouter } from '../../lib/api';
import { APIHandler } from './api';
import { Explain } from './index';
import { ModuleConfig } from '..';

export function initRouting({ app }: ModuleConfig<typeof Explain>): void {
	const router = createRouter(Explain, APIHandler);
	router.post('/time/:mins', 'getLastXMins');
	router.post('/amount/:amount', 'getLastX');
	router.use(app);
}
