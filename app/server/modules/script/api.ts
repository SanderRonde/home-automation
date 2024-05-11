import {
	ResponseLike,
	attachSourcedMessage,
	attachMessage,
} from '@server/lib/logger';
import { errorHandle, requireParams, authAll } from '@server/lib/decorators';
import * as childProcess from 'child_process';
import { AuthError } from '@server/lib/errors';
import { Config } from '@server/app';
import * as path from 'path';
import { Script } from '.';
import chalk from 'chalk';

export class APIHandler {
	@errorHandle
	@requireParams('auth', 'name')
	@authAll
	public static async script(
		res: ResponseLike,
		params: {
			auth?: string;
			name: string;
		},
		config: Config,
		source: string
	): Promise<string> {
		if (params.name.indexOf('..') > -1 || params.name.indexOf('/') > -1) {
			throw new AuthError('Going up dirs is not allowed');
		}
		const scriptPath = path.join(config.scripts.scriptDir, params.name);
		attachSourcedMessage(
			res,
			source,
			await Script.explainHook,
			`Script: "${scriptPath}"`
		);
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
			attachMessage(res, `Output: "${output}"`);
			res.write(output);
			res.status(200);
			res.end();
			return output;
		} catch (e) {
			const err = e as {
				message: string;
				stack: string;
			};
			const errMsg = attachMessage(
				res,
				chalk.bgRed(chalk.black(`Error: ${err.message}`))
			);
			for (const line of err.stack.split('\n')) {
				attachMessage(errMsg, chalk.bgRed(chalk.black(line)));
			}
			res.status(400).end();
			return '';
		}
	}
}
