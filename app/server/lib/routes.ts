import { RouteHandler } from './route-handler';
import * as express from 'express';
import { Database } from './db';
import { Config } from '../app';

export function initRoutes(app: express.Express, db: Database, config: Config) {
	app.use((req, _res, next) => {
		console.log('Got request', req.url, 'from', req.ip);
		next();
	});
	app.get('/:auth/:key', (req, res, _next) => {
		RouteHandler.get(res, req.params, db);
	});
	app.get('/long/:maxtime/:auth/:key/:expected', (req, res, _next) => {
		RouteHandler.getLongPoll(res, req.params, db);
	});
	app.get('/script/:auth/:name', (req, res, _next) => {
		RouteHandler.script(res, req.params, config);
	});
	app.all('/:auth/:key/:value', (req, res, _next) => {
		RouteHandler.set(res, req.params, db);
	});
	app.use((_req, res, _next) => {
		res.status(404).send('404');
	});
}