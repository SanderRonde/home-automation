import { errorHandle, requireParams, authAll } from '../../lib/decorators';
import type { ResponseLike } from '../../lib/logging/response-logger';
import { LogObj } from '../../lib/logging/lob-obj';
import * as childProcess from 'child_process';
import { AuthError } from '../../lib/errors';
import type { Config } from '../../app';
import * as path from 'path';
import chalk from 'chalk';

export class APIHandler {
	@errorHandle
	@requireParams('auth', 'name')
	@authAll
	public static script(
		res: ResponseLike,
		params: {
			auth?: string;
			name: string;
		},
		config: Config
	): string {
		if (params.name.indexOf('..') > -1 || params.name.indexOf('/') > -1) {
			throw new AuthError('Going up dirs is not allowed');
		}
		const scriptPath = path.join(config.scripts.scriptDir, params.name);
		const logObj = LogObj.fromRes(res);
		logObj.attachMessage(`Script: "${scriptPath}"`);
		try {
			const output = childProcess
				.execFileSync(
					path.join(config.scripts.scriptDir, params.name),
					{
						uid: config.scripts.uid,
						gid: config.scripts.uid,
					}
				)
				.toString();
			logObj.attachMessage(`Output: "${output}"`);
			res.write(output);
			res.status(200);
			res.end();
			return output;
		} catch (e) {
			const err = e as {
				message: string;
				stack: string;
			};
			const errMsg = logObj.attachMessage(
				chalk.bgRed(chalk.black(`Error: ${err.message}`))
			);
			for (const line of err.stack.split('\n')) {
				errMsg.attachMessage(chalk.bgRed(chalk.black(line)));
			}
			res.status(400).end();
			return '';
		}
	}
}
