import { AsyncExpressApplication } from '../../types/express';
import { createRouter } from '../../lib/api';
import { APIHandler } from './api';
import { Config } from '../../app';
import { Script } from '.';

export function initRouting({
	app,
	config,
}: {
	app: AsyncExpressApplication;
	config: Config;
}): void {
	const router = createRouter(Script, APIHandler);
	router.post('/:name', async (req, res) => {
		await APIHandler.script(
			res,
			{
				...req.params,
				...req.body,
				...req.query,
				cookies: req.cookies,
			},
			config,
			`${Script.name}.API.${req.url}`
		);
	});
	router.use(app);
}
