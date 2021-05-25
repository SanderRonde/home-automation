import { Movement } from '.';
import { ModuleConfig } from '..';
import { createRouter } from '../../lib/api';
import { APIHandler } from './api';

export function initRouting({ app }: ModuleConfig): void {
	const router = createRouter(Movement, APIHandler);
	router.post('/:key', 'reportMovement');
	router.use(app);
}
