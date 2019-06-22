import { initRGBRoutes, scanRGBControllers } from '../modules/rgb';
import { initKeyValRoutes } from '../modules/keyval';
import { initScriptRoutes } from '../modules/script';
import * as cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';
import * as express from 'express';
import { logReq } from './logger';
import { Database } from './db';
import { Config } from '../app';
import { Auth } from './auth';

export async function initRoutes(app: express.Express, config: Config) {
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
	
	initKeyValRoutes(app, new Database('keyval.json'));
	initScriptRoutes(app, config);
	await initRGBRoutes(app);
	await Auth.initRoutes(app, config);
	
	app.post('/scan', (_req, res) => {
		scanRGBControllers();
		res.status(200).end();
	});

	app.use((_req, res, _next) => {
		res.status(404).send('404');
	});
}