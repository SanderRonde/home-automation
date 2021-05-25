import * as express from 'express';
import { Script } from '.';
import { Config } from '../../app';
import { createRouter } from '../../lib/api';
import { APIHandler } from './api';

export function initRouting({
	app,
	config,
}: {
	app: express.Application;
	config: Config;
}): void {
	const router = createRouter(Script, APIHandler);
	router.post('/:name', async (req, res, _next) => {
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
