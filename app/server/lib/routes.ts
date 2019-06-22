import { initKeyValRoutes } from '../modules/keyval';
import { initScriptRoutes } from '../modules/script';
import { sanitize, initAuthRoutes } from './auth';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import { Database } from './db';
import { Config } from '../app';
import chalk from 'chalk';

function logReq(req: express.Request, res: express.Response) {
	const start = Date.now();
	res.on('finish', async () => {
		const end = Date.now();
		if (res.statusCode === 200) {
			console.log(chalk.green(`[${res.statusCode}]`),
				chalk.bgGreen(chalk.black(await sanitize(req.url))), 'from ip',
				chalk.bold(req.ip), `(${end - start} ms)`);
		} else if (res.statusCode === 500) {
			console.log(chalk.red(`[${res.statusCode}]`),
				chalk.bgRed(chalk.black(await sanitize(req.url))), 'from ip',
				chalk.bold(req.ip), `(${end - start} ms)`);
		} else {
			console.log(chalk.yellow(`[${res.statusCode}]`),
				chalk.bgYellow(chalk.black(await sanitize(req.url))), 'from ip',
				chalk.bold(req.ip), `(${end - start} ms)`);
		}
	});
}

export async function initRoutes(app: express.Express, db: Database, config: Config) {
	app.use(cookieParser());
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