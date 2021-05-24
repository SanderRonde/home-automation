import { logReq, attachMessage } from './logger';
import * as cookieParser from 'cookie-parser';
import * as serveStatic from 'serve-static';
import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as path from 'path';
import * as glob from 'glob';
import chalk from 'chalk';
import { RGB } from '../modules';

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

export function initRoutes(app: express.Express): void {
	app.post('/scan', async (_req, res) => {
		await RGB.Scan.scanRGBControllers();
		res.status(200).end();
	});
}

export function initPostRoutes(app: express.Express): void {
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
				for (const line of err.stack!.split('\n')) {
					attachMessage(res, chalk.bgRed(chalk.black(line)));
				}
				res.end();
			}
		}
	);
}
