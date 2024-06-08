import { createRouter } from '../../lib/api';
import type { ModuleConfig } from '..';
import { APIHandler } from './api';
import { Webhook } from '.';

export function initRouting({ app }: ModuleConfig<typeof Webhook>): void {
	const router = createRouter(Webhook, APIHandler);
	router.post('/:name', 'webhook');
	router.use(app);
}
