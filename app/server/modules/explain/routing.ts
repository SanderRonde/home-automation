import { createRouter } from '@server/lib/api';
import { APIHandler } from '@server/modules/explain/api';
import { Explain } from '@server/modules/explain/index';
import { ModuleConfig } from '..';

export function initRouting({ app }: ModuleConfig<typeof Explain>): void {
	const router = createRouter(Explain, APIHandler);
	router.post('/time/:mins', 'getLastXMins');
	router.post('/amount/:amount', 'getLastX');
	router.use(app);
}
