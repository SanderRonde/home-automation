import { Pressure } from '.';
import { ModuleConfig } from '..';
import { createRouter } from '../../lib/api';
import { disableMessages } from '../../lib/logger';
import { APIHandler } from './api';

export function initRouting({ app, config }: ModuleConfig): void {
	const router = createRouter(Pressure, APIHandler);
	router.post('/:key/:pressure', async (req, res) => {
		if (config.log.ignorePressure) {
			disableMessages(res);
		}
		await APIHandler.reportPressure(res, {
			...req.params,
			...req.body,
			...req.query,
			cookies: req.cookies,
		});
	});
	router.use(app);
}
