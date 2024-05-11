import { disableMessages } from '../../lib/logger';
import { PressureValueKeeper } from './values';
import { createRouter } from '../../lib/api';
import { APIHandler } from './api';
import { ModuleConfig } from '..';
import { Pressure } from '.';

export function initRouting(
	{ app, config }: ModuleConfig<typeof Pressure>,
	valueKeeper: PressureValueKeeper
): void {
	const apiHandler = new APIHandler(valueKeeper);
	const router = createRouter(Pressure, apiHandler);
	router.post('/:key/:pressure', async (req, res) => {
		if (config.log.ignorePressure) {
			disableMessages(res);
		}
		await apiHandler.reportPressure(res, {
			...req.params,
			...req.body,
			...req.query,
			cookies: req.cookies,
		});
	});
	router.use(app);
}
