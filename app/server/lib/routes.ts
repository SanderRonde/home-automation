import { initKeyValRoutes } from '../modules/keyval';
import { initScriptRoutes } from '../modules/script';
import { initAuthRoutes } from './auth';
import * as cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';
import * as express from 'express';
import { Database } from './db';
import { Config } from '../app';
import { logReq } from './logger';

export async function initRoutes(app: express.Express, db: Database, config: Config) {
	app.use(cookieParser());
	app.use(bodyParser.json({
		type: '*/json'
	}));
	app.use(bodyParser.urlencoded({
		extended: false
	}));
	app.use((req, res, next) => {
		logReq(req, res);
		next();
	});
	
	initKeyValRoutes(app, db);
	initScriptRoutes(app, db, config);
	await initAuthRoutes(app);
	
	app.use((_req, res, _next) => {
		res.status(404).send('404');
	});
}