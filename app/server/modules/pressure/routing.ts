import type { PressureValueKeeper } from './values';
import { LogObj } from '../../lib/logging/lob-obj';
import { createRouter } from '../../lib/api';
import type { ModuleConfig } from '..';
import { APIHandler } from './api';
import { Pressure } from '.';

export function initRouting(
	{ app, config }: ModuleConfig<typeof Pressure>,
	valueKeeper: PressureValueKeeper
): void {
	const apiHandler = new APIHandler(valueKeeper);
	const router = createRouter(Pressure, apiHandler);
	router.post('/:key/:pressure', async (req, res) => {
		if (config.log.ignorePressure) {
			LogObj.fromIncomingReq(req, res).ignore = true;
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
