import { Webhook } from '.';
import { ModuleConfig } from '..';
import { createRouter } from '../../lib/api';
import { APIHandler } from './api';

export function initRouting({ app }: ModuleConfig): void {
	const router = createRouter(Webhook, APIHandler);
	router.post('/:name', 'webhook');
	router.use(app);
}
