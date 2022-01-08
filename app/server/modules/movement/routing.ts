import { createRouter } from '../../lib/api';
import { APIHandler } from './api';
import { ModuleConfig } from '..';
import { Movement } from '.';

export function initRouting({ app }: ModuleConfig): void {
	const router = createRouter(Movement, APIHandler);
	router.post('/:key', 'reportMovement');
	router.use(app);
}
