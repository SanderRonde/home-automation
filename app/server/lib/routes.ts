import { logReq, attachMessage } from './logger';
import { ResponseLike } from '../modules/multi';
import * as pathToRegexp from 'path-to-regexp';
import * as cookieParser from 'cookie-parser';
import * as serveStatic from 'serve-static';
import * as bodyParser from 'body-parser';
import { RGB } from '../modules';
import * as express from 'express';
import * as path from 'path';
import * as glob from 'glob';
import chalk from 'chalk';

type Handler = (
	req: express.Request,
	res: ResponseLike,
	next: express.NextFunction
) => any;

export class AppWrapper {
	constructor(public app: express.Express) {}

	private _routes: {
		route: string;
		matching: {
			regexp: RegExp;
			keys: pathToRegexp.Key[];
		};
		handler: Handler;
		method: string;
	}[] = [];

	private _genRegexp(route: string) {
		const keys: pathToRegexp.Key[] = [];
		const regexp = pathToRegexp(route, keys);
		return { keys, regexp };
	}

	private static _makeArr<V>(value: V | V[]): V[] {
		if (Array.isArray(value)) return value;
		return [value];
	}

	get(route: string | string[], handler: Handler) {
		const routes = AppWrapper._makeArr(route);
		routes.forEach(route => {
			this._routes.push({
				route,
				handler,
				method: 'get',
				matching: this._genRegexp(route)
			});
		});
		this.app.get(route, handler);
	}

	post(route: string | string[], handler: Handler) {
		const routes = AppWrapper._makeArr(route);
		routes.forEach(route => {
			this._routes.push({
				route,
				handler,
				method: 'post',
				matching: this._genRegexp(route)
			});
		});
		this.app.post(route, handler);
	}

	all(route: string | string[], handler: Handler) {
		const routes = AppWrapper._makeArr(route);
		routes.forEach(route => {
			this._routes.push({
				route,
				handler,
				method: 'all',
				matching: this._genRegexp(route)
			});
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
				err.message = "Failed to decode param '" + val + "'";
			}

			throw err;
		}
	}

	private _matchRoute(
		matching: {
			regexp: RegExp;
			keys: pathToRegexp.Key[];
		},
		expected: string,
		actual: string
	): null | {
		[key: string]: string;
	} {
		if (expected === '*') {
			return { '0': this._decodeParam(actual) };
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

	async triggerRoute(
		req: express.Request,
		res: ResponseLike,
		method: string,
		actual: string,
		bodyParams: {
			[key: string]: string;
		}
	) {
		for (const {
			handler,
			method: routeMethod,
			route: expected,
			matching
		} of this._routes) {
			if (routeMethod.toLowerCase() !== method.toLowerCase()) continue;
			const urlParams = this._matchRoute(matching, expected, actual);
			if (!urlParams) continue;

			req.body = { ...bodyParams, ...urlParams };
			await handler(req, res, () => {});
			return;
		}
	}
}

export async function initAnnotatorRoutes(app: express.Express) {
	app.all('/annotator/files', (_req, res) => {
		glob(
			path.join(__dirname, '../../../', 'ai/files', '*.wav'),
			{},
			(err: Error | null, files: string[]) => {
				if (err) {
					res.status(500);
					res.end();
				} else {
					res.status(200);
					res.write(
						JSON.stringify({
							files: files.map((file: string) =>
								file.split('/').pop()
							)
						})
					);
					res.end();
				}
			}
		);
	});
}

export async function initMiddleware(app: express.Express) {
	app.use((req, res, next) => {
		logReq(req, res);
		next();
	});
	app.use(cookieParser());
	app.use(
		bodyParser.json({
			type: '*/json'
		})
	);
	app.use(
		bodyParser.urlencoded({
			extended: true
		})
	);
	app.use(bodyParser.text());
	app.use(serveStatic(path.join(__dirname, '../../../', 'app/client/')));
	app.use(serveStatic(path.join(__dirname, '../../../', 'static/')));
	app.use(serveStatic(path.join(__dirname, '../../../', 'ai/annotator/')));
	app.use(serveStatic(path.join(__dirname, '../../../', 'ai/files/')));
	app.use(
		'/node_modules/lit-html',
		(req, _res, next) => {
			req.url = req.url.replace('/node_modules/lit-html', '');
			next();
		},
		serveStatic(path.join(__dirname, '../../../', 'node_modules/lit-html'))
	);
	app.use(
		'/node_modules/wc-lib',
		(req, _res, next) => {
			req.url = req.url.replace('/node_modules/wc-lib', '');
			next();
		},
		serveStatic(path.join(__dirname, '../../../', 'node_modules/wc-lib'))
	);
}

export async function initRoutes(app: express.Express) {
	app.post('/scan', (_req, res) => {
		RGB.Scan.scanRGBControllers();
		res.status(200).end();
	});
}

export async function initPostRoutes(app: express.Express) {
	app.use((_req, res, _next) => {
		res.status(404).send('404');
	});
	app.use(
		(
			err: Error,
			_req: express.Request,
			res: express.Response,
			_next: express.NextFunction
		) => {
			if (err && err.message) {
				if (res.headersSent) {
					console.log(
						chalk.bgRed(
							chalk.black(
								'Got error after headers were sent',
								err.message,
								err.stack!
							)
						)
					);
					return;
				}
				res.status(500).write('Internal server error');
				for (const line of err.stack!.split('\n')) {
					attachMessage(res, chalk.bgRed(chalk.black(line)));
				}
				res.end();
			}
		}
	);
}
