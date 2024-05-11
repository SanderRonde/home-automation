import { createRouter } from '@server/lib/api';
import { APIHandler } from '@server/modules/webhook/api';
import { ModuleConfig } from '..';
import { Webhook } from '.';

export function initRouting({ app }: ModuleConfig<typeof Webhook>): void {
	const router = createRouter(Webhook, APIHandler);
	router.post('/:name', 'webhook');
	router.use(app);
}
