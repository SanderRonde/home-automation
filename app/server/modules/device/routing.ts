import { createRouter } from '../../lib/api';
import type { APIHandler } from './api';
import type { ModuleConfig } from '..';
import { Device } from '.';

export function initRouting({
	app,
	apiHandler,
}: ModuleConfig<typeof Device> & { apiHandler: APIHandler }): void {
	const router = createRouter(Device, apiHandler);

	// Device management endpoints
	router.get('/list', 'getDeviceList');
	router.post('/update-name', 'updateDeviceName');

	router.use(app);
}
