import { AsyncExpressApplication } from '@server/types/express';
import { createRouter } from '@server/lib/api';
import { Config } from '@server/app';
import { APIHandler } from '@server/modules/script/api';
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
