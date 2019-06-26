import { initRGBRoutes, scanRGBControllers } from '../modules/rgb';
import { initKeyValRoutes } from '../modules/keyval';
import { initScriptRoutes } from '../modules/script';
import { initMultiRoutes } from '../modules/multi';
import * as pathToRegexp from 'path-to-regexp';
import * as cookieParser from 'cookie-parser';
import * as serveStatic from 'serve-static';
import * as bodyParser from 'body-parser';
import * as express from 'express';
import { logReq, attachMessage } from './logger';
import { WSWrapper } from './ws';
import { Database } from './db';
import { Config } from '../app';
import { Auth } from './auth';
import * as path from 'path';
import chalk from 'chalk';

export interface ResponseLike {
	status(code: number): this;
	write(str: string): void;
	end(): void;
	contentType(type: string): void;
	cookie(name: string, value: string): void;
}

export class ResponseDummy implements ResponseLike {
	private _status: number = 200;
	private _written: string[] = [];
	private _contentType: string|null = null;
	private _cookies: [string, string][] = [];

	constructor(private _res: express.Response) { }

	status(code: number) {
		if (code !== 200) {
			this._status = code;
		}
		return this;
	}

	write(str: string) {
		this._written.push(str);
	}

	end() {}

	contentType(type: string) {
		this._contentType = type;
	}

	cookie(name: string, value: string) {
		this._cookies.push([name, value]);
	}

	apply() {
		this._res.status(this._status);
		this._res.write(JSON.stringify(this._written));
		if (this._contentType) {
			this._res.contentType(this._contentType);
		}
		for (const [ key, val ] of this._cookies) {
			this._res.cookie(key, val);
		}
		this._res.end();
	}
}

type Handler = (req: express.Request, res: ResponseLike, next: express.NextFunction) => any;

export class AppWrapper {
	constructor(public app: express.Express) {}

	private _routes: {
		route: string;
		matching: {
			regexp: RegExp;
			keys: pathToRegexp.Key[];
		}
		handler: Handler;
		method: string;
	}[] = [];

	private _genRegexp(route: string) {
		const keys: pathToRegexp.Key[] = [];
		const regexp = pathToRegexp(route, keys);
		return { keys, regexp };
	}

	get(route: string, handler: Handler) {
		this._routes.push({
			route, handler, method: 'get',
			matching: this._genRegexp(route)
		});
		this.app.get(route, handler);
	}

	post(route: string, handler: Handler) {
		this._routes.push({
			route, handler, method: 'post',
			matching: this._genRegexp(route)
		});
		this.app.post(route, handler);
	}

	all(route: string, handler: Handler) {
		this._routes.push({
			route, handler, method: 'all',
			matching: this._genRegexp(route)
		});
		this.app.all(route, handler);
	}

	private _decodeParam(val: any) {
		if (typeof val !== 'string' || val.length === 0) {
		  return val;
		}
	  
		try {
		  	return decodeURIComponent(val);
		} catch (err) {
			if (err instanceof URIError) {
				err.message = 'Failed to decode param \'' + val + '\'';
			}
	  
		  throw err;
		}
	}

	private _matchRoute(matching: {
		regexp: RegExp;
		keys: pathToRegexp.Key[];
	}, expected: string, actual: string): null|{
		[key: string]: string;
	} {
		if (expected === '*') {
			return { '0': this._decodeParam(actual) }
		}
		if (expected === '/') {
			return {};
		}

		const match = matching.regexp.exec(actual);
		if (!match) {
			return null;
		}

		const params: {
			[key: string]: string;
		} = {};

		for (let i = 1; i < match.length; i++) {
			const key = matching.keys[i - 1];
			const prop = key.name;
			const val = this._decodeParam(match[i]);
			if (val !== undefined) {
				params[prop] = val;
			}
		}

		return params;
	}

	async triggerRoute(req: express.Request, res: ResponseDummy, method: string, 
		actual: string, bodyParams: {
			[key: string]: string;
		}) {
			for (const { handler, method: routeMethod, route: expected, matching } of this._routes) {
				if (routeMethod.toLowerCase() !== method.toLowerCase()) continue;
				const urlParams = this._matchRoute(matching, expected, actual);
				if (!urlParams) continue;

				req.body = {...bodyParams, ...urlParams};
				await handler(req, res, () => {});
				return;
			}
		}
}

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
		extended: true
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
	
	const wrappedApp = new AppWrapper(app);
	initKeyValRoutes(wrappedApp, websocket, await new Database('keyval.json').init());
	initScriptRoutes(wrappedApp, config);
	await initRGBRoutes(wrappedApp);
	await Auth.initRoutes(wrappedApp, config);
	initMultiRoutes(wrappedApp);
	
	app.post('/scan', (_req, res) => {
		scanRGBControllers();
		res.status(200).end();
	});

	app.use((_req, res, _next) => {
		res.status(404).send('404');
	});
	app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		if (err && err.message) {
			res.status(500).write('Internal server error');
			for (const line of err.stack!.split('\n')) {
				attachMessage(res, chalk.bgRed(chalk.black(line)));
			}
			res.end();
		}
	});
}