import { createRouter } from '../../lib/api';
import type { ModuleConfig } from '..';
import { APIHandler } from './api';
import { Movement } from '.';

export function initRouting({ app }: ModuleConfig<typeof Movement>): void {
	const router = createRouter(Movement, APIHandler);
	router.post('/:key', 'reportMovement');
	router.use(app);
}
