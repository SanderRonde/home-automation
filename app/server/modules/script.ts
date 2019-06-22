import { errorHandle, requireParams, auth } from "../lib/decorators";
import * as childProcess from 'child_process';
import { AuthError } from "../lib/errors";
import { Database } from "../lib/db";
import * as express from 'express';
import { Config } from "../app";
import * as path from 'path';

class APIHandler {
	@errorHandle
	@requireParams('auth', 'name')
	@auth
	public static async script(res: express.Response, params: {
		auth: string;
		name: string;
	}, config: Config) {
		if (params.name.indexOf('..') > -1 || params.name.indexOf('/') > -1) {
			throw new AuthError('Going up dirs is not allowed');
		}
		res.write(childProcess.execFileSync(
			path.join(config.scripts.scriptDir, params.name), {
				uid: config.scripts.uid,
				gid: config.scripts.uid
			}).toString());
		res.status(200);
		res.end();
	}
}

export function initScriptRoutes(app: express.Express, _db: Database, config: Config) {
	app.get('/script/:auth/:name', (req, res, _next) => {
		APIHandler.script(res, req.params, config);
	});
}