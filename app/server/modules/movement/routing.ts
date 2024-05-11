import { createRouter } from '@server/lib/api';
import { APIHandler } from '@server/modules/movement/api';
import { ModuleConfig } from '..';
import { Movement } from '.';

export function initRouting({ app }: ModuleConfig<typeof Movement>): void {
	const router = createRouter(Movement, APIHandler);
	router.post('/:key', 'reportMovement');
	router.use(app);
}
