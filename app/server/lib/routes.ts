import { initKeyValRoutes } from '../modules/keyval';
import { initScriptRoutes } from '../modules/script';
import * as express from 'express';
import { Database } from './db';
import { Config } from '../app';

export function initRoutes(app: express.Express, db: Database, config: Config) {
	app.use((req, _res, next) => {
		console.log('Got request', req.url, 'from', req.ip);
		next();
	});
	
	initKeyValRoutes(app, db);
	initScriptRoutes(app, db, config);
	
	app.use((_req, res, _next) => {
		res.status(404).send('404');
	});
}