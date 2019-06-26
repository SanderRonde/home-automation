import { errorHandle, requireParams, auth } from "../lib/decorators";
import * as childProcess from 'child_process';
import { attachMessage } from "../lib/logger";
import { AppWrapper } from "../lib/routes";
import { AuthError } from "../lib/errors";
import { ResponseLike } from "./multi";
import { Config } from "../app";
import * as path from 'path';
import chalk from 'chalk';

class APIHandler {
	@errorHandle
	@requireParams('auth', 'name')
	@auth
	public static async script(res: ResponseLike, params: {
		auth: string;
		name: string;
	}, config: Config) {
		if (params.name.indexOf('..') > -1 || params.name.indexOf('/') > -1) {
			throw new AuthError('Going up dirs is not allowed');
		}
		const scriptPath = path.join(config.scripts.scriptDir, params.name);
		attachMessage(res, `Script: "${scriptPath}"`);
		try {
			const output = childProcess.execFileSync(
				path.join(config.scripts.scriptDir, params.name), {
					uid: config.scripts.uid,
					gid: config.scripts.uid
				}).toString();
			attachMessage(res, `Output: "${output}"`);
			res.write(output);
			res.status(200);
			res.end();
		} catch(e) {
			const errMsg = attachMessage(res, chalk.bgRed(chalk.black(`Error: ${e.message}`)));
			for (const line of e.stack.split('\n')) {
				attachMessage(errMsg, chalk.bgRed(chalk.black(line)));
			}
			res.status(400).end();
		}
	}
}

export function initScriptRoutes(app: AppWrapper, config: Config) {
	app.post('/script/:name', (req, res, _next) => {
		APIHandler.script(res, {...req.params, ...req.body}, config);
	});
}