import { createRouter } from '../../lib/api';
import { APIHandler } from './api';
import { ModuleConfig } from '..';
import { Explain } from './index';

export function initRouting({ app }: ModuleConfig): void {
	const router = createRouter(Explain, APIHandler);
	router.post('/time/:mins', 'getLastXMins');
	router.post('/amount/:amount', 'getLastX');
	router.use(app);
}
