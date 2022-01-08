import { disableMessages } from '../../lib/logger';
import { createRouter } from '../../lib/api';
import { APIHandler } from './api';
import { ModuleConfig } from '..';
import { Pressure } from '.';

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
