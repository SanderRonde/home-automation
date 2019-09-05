import { errorHandle, requireParams, auth } from "../lib/decorators";
import * as childProcess from 'child_process';
import { attachMessage, ResDummy } from "../lib/logger";
import { AppWrapper } from "../lib/routes";
import { AuthError } from "../lib/errors";
import { ResponseLike } from "./multi";
import { Auth } from "../lib/auth";
import { Config } from "../app";
import * as path from 'path';
import chalk from 'chalk';

interface ExternalRequest {
	type: 'script';
	name: string;
	logObj: any;
	resolver: () => void;
}

export class ScriptExternal {
	private static _config: Config|null = null;
	private static _requests: ExternalRequest[] = [];

	static logObj: any;

	static async init({ config }: { config: Config }) {
		this._config = config;
		for (const req of this._requests) {
			await this._handleRequest(req);
		}
	}

	private static async _handleRequest(request: ExternalRequest) {
		const dummy = new ResDummy();
		await APIHandler.script(dummy, {
			name: request.name,
			auth: await Auth.Secret.getKey()
		}, this._config!);
	}

	static async script(name: string) {
		return new Promise((resolve) => {
			const req: ExternalRequest = {
				type: 'script',
				name,
				logObj: this.logObj,
				resolver: resolve
			};
			if (this._config) {
				this._handleRequest(req);
			} else {
				this._requests.push(req);
			}
		});
	}
}

class APIHandler {
	@errorHandle
	@requireParams('auth', 'name')
	@auth
	public static async script(res: ResponseLike, params: {
		auth?: string;
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
	app.post('/script/:name', async (req, res, _next) => {
		await APIHandler.script(res, {...req.params, ...req.body}, config);
	});
}