import { logReq, reportReqError } from '@server/lib/logger';
import { BaseModuleConfig } from '@server/modules';
import cookieParser from 'cookie-parser';
import serveStatic from 'serve-static';
import * as Sentry from '@sentry/node';
import bodyParser from 'body-parser';
import express from 'express';
import { getEnv } from '@server/lib/io';
import * as path from 'path';
import pm2 from '@pm2/io';
import chalk from 'chalk';
import glob from 'glob';

export function initAnnotatorRoutes(app: express.Express): void {
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
							),
						})
					);
					res.end();
				}
			}
		);
	});
}

export function initMiddleware({ app, config }: BaseModuleConfig): void {
	if (getEnv('SECRET_SENTRY_DSN')) {
		app.use(
			Sentry.Handlers.requestHandler({
				ip: true,
				request: true,
				user: false,
				serverName: true,
			})
		);
		app.use(Sentry.Handlers.tracingHandler());
	}
	app.use((req, res, next) => {
		logReq(req, res, config);
		next();
	});
	app.use(cookieParser());
	app.use(
		bodyParser.json({
			type: '*/json',
		})
	);
	app.use(
		bodyParser.urlencoded({
			extended: true,
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

export function initPostRoutes(app: express.Express): void {
	if (getEnv('SECRET_SENTRY_DSN')) {
		app.use(Sentry.Handlers.errorHandler());
	}
	app.use((_req, res) => {
		res.status(404).send('404');
	});
	app.use((err: Error, req: express.Request, res: express.Response) => {
		console.log('got err', err);
		if (err?.message) {
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
			reportReqError(req, err);
			pm2.expressErrorHandler()(err, req, res, () => {});
			res.end();
		}
	});
}
