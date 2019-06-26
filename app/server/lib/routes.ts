import { initRGBRoutes, scanRGBControllers } from '../modules/rgb';
import { initKeyValRoutes } from '../modules/keyval';
import { initScriptRoutes } from '../modules/script';
import * as cookieParser from 'cookie-parser';
import * as serveStatic from 'serve-static';
import * as bodyParser from 'body-parser';
import * as express from 'express';
import { logReq } from './logger';
import { WSWrapper } from './ws';
import { Database } from './db';
import { Config } from '../app';
import { Auth } from './auth';
import * as path from 'path';

export async function initRoutes(app: express.Express, websocket: WSWrapper, config: Config) {
	app.use((req, res, next) => {
		logReq(req, res);
		next();
	});
	app.use(cookieParser());
	app.use(bodyParser.json({
		type: '*/json'
	}));
	app.use(bodyParser.urlencoded({
		extended: false
	}));
	app.use(serveStatic(
		path.join(__dirname, '../../../', 'app/client/')));
	app.use('/node_modules/lit-html', (req, _res, next) => {
		req.url = req.url.replace('/node_modules/lit-html', '');
		next();
	}, serveStatic(path.join(__dirname, '../../../', 'node_modules/lit-html')));
	app.use('/node_modules/wclib', (req, _res, next) => {
		req.url = req.url.replace('/node_modules/wclib', '');
		next();
	}, serveStatic(path.join(__dirname, '../../../', 'node_modules/wclib')));
	
	initKeyValRoutes(app, websocket, await new Database('keyval.json').init());
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