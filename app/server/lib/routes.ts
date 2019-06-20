import { RouteHandler } from './route-handler';
import * as express from 'express';
import { Database } from './db';

export function initRoutes(app: express.Express, db: Database) {
	app.get('/:auth/:key', (req, res, _next) => {
		RouteHandler.get(res, req.params, db);
	});
	app.all('/:auth/:key/:value', (req, res, _next) => {
		RouteHandler.set(res, req.params, db);
	});
	app.use((_req, res, _next) => {
		res.status(404).send('404');
	});
}