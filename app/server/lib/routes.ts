import { logReq, reportReqError } from './logger';
import { expressErrorHandler } from '@pm2/io';
import cookieParser from 'cookie-parser';
import serveStatic from 'serve-static';
import bodyParser from 'body-parser';
import express from 'express';
import * as path from 'path';
import glob from 'glob';
import chalk from 'chalk';

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

export function initMiddleware(app: express.Express): void {
	app.use((req, res, next) => {
		logReq(req, res);
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
	app.use((_req, res, _next) => {
		res.status(404).send('404');
	});
	app.use(
		(
			err: Error,
			req: express.Request,
			res: express.Response,
			next: express.NextFunction
		) => {
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
				expressErrorHandler()(err, req, res, next);
				res.end();
			}
		}
	);
}
