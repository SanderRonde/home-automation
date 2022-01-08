import { createRouter } from '../../lib/api';
import { APIHandler } from './api';
import { ModuleConfig } from '..';
import { Webhook } from '.';

export function initRouting({ app }: ModuleConfig): void {
	const router = createRouter(Webhook, APIHandler);
	router.post('/:name', 'webhook');
	router.use(app);
}
