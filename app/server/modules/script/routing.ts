import { AsyncExpressApplication } from '../../types/express';
import { createRouter } from '../../lib/api';
import { Config } from '../../app';
import { APIHandler } from './api';
import { Script } from '.';

export function initRouting({
	app,
	config,
}: {
	app: AsyncExpressApplication;
	config: Config;
}): void {
	const router = createRouter(Script, APIHandler);
	router.post('/:name', (req, res) => {
		APIHandler.script(
			res,
			{
				...req.params,
				...req.body,
				...req.query,
				cookies: req.cookies,
			},
			config
		);
	});
	router.use(app);
}
