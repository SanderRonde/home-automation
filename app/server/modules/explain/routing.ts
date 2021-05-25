import { Explain } from './index';
import { ModuleConfig } from '..';
import { APIHandler } from './api';
import { createRouter } from '../../lib/api';

export function initRouting({ app }: ModuleConfig): void {
	const router = createRouter(Explain, APIHandler);
	router.post('/time/:mins', 'getLastXMins');
	router.post('/amount/:amount', 'getLastX');
	router.use(app);
}
