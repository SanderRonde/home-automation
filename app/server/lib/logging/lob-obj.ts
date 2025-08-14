import { externalRedact } from '../../modules/auth/helpers';
import type { ResponseLike } from './response-logger';
import { generateRandomString } from '../random';
import { getTime, warning } from './logger';
import type { WSSimInstance } from '../ws';
import { getIP } from './request-logger';
import { gatherTimings } from '../timer';
import type { AppConfig } from '../../app';
import type * as express from 'express';
import * as fs from 'fs/promises';
import type * as http from 'http';
import chalk from 'chalk';

interface AssociatedMessage {
	content: string[];
	logObj: LogObj;
}

export class LogObj {
	private static _objMap: WeakMap<
		ResponseLike | WSSimInstance | express.Request | http.ClientRequest,
		LogObj
	> = new WeakMap();
	public static logLevel: number = 1;

	private _messages: AssociatedMessage[] = [];
	private _finalized: boolean = false;
	private _timeout: number = 1000;

	public ignore: boolean = false;

	private constructor() {}

	private static _log(...params: unknown[]) {
		console.log(
			params
				.map((param) => {
					if (typeof param === 'string') {
						return param;
					}
					if (typeof param === 'number') {
						return String(param);
					}
					return JSON.stringify(param);
				})
				.join(' ')
		);
	}

	private _onDone(cb: () => void): void {
		setTimeout(() => {
			this._finalized = true;
			cb();
		}, this._timeout);
	}

	public static fromParent(timeout?: number): LogObj {
		const obj = new LogObj();
		obj._timeout = timeout ?? obj._timeout;
		return obj;
	}

	public static fromEvent(name: string, timeout?: number): LogObj {
		const obj = new LogObj();
		obj._timeout = timeout ?? obj._timeout;

		obj._onDone(() => {
			if (LogObj.logLevel < 1 || obj._messages.length === 0) {
				return;
			}
			LogObj._log(getTime(), chalk.yellow('[event]'), chalk.bold(name));
			obj._logMessages();
		});

		return obj;
	}

	public static fromFixture(
		tag: string,
		source: string,
		timeout?: number
	): LogObj {
		const obj = new LogObj();
		obj._timeout = timeout ?? obj._timeout;

		obj._onDone(() => {
			if (LogObj.logLevel < 1) {
				return;
			}
			LogObj._log(getTime(), tag, `[${source}]`);
			obj._logMessages();
		});

		return obj;
	}

	public static fromRes(res: ResponseLike, timeout?: number): LogObj {
		if (!LogObj._objMap.has(res)) {
			const obj = new LogObj();
			obj._timeout = timeout ?? obj._timeout;
			LogObj._objMap.set(res, obj);
		}
		return LogObj._objMap.get(res)!;
	}

	public static fromOutgoingReq(
		req: http.ClientRequest,
		timeout?: number
	): LogObj {
		if (LogObj._objMap.has(req)) {
			return LogObj._objMap.get(req)!;
		}
		const obj = new LogObj();
		obj._timeout = timeout ?? obj._timeout;
		LogObj._objMap.set(req, obj);

		const start = Date.now();
		req.once('response', (res) => {
			const end = Date.now();

			obj._onDone(() => {
				if (LogObj.logLevel < 1) {
					return;
				}

				const [statusColor, ipBg] = (() => {
					if (res.statusCode === 200) {
						return [chalk.green, chalk.bgGreen];
					} else if (res.statusCode === 500) {
						return [chalk.red, chalk.bgRed];
					} else {
						return [chalk.yellow, chalk.bgYellow];
					}
				})();

				LogObj._log(
					getTime(),
					statusColor(`[${res.statusCode}]`),
					`[${req.method.toUpperCase()}]`,
					ipBg(chalk.black(externalRedact(`${req.host}${req.path}`))),
					'->',
					`(${end - start} ms)`
				);

				obj._logMessages();
			});
		});

		return obj;
	}

	private _logMessages(depth: number = 0, hasNextMessage: boolean[] = []) {
		// 0 = no depth, 1 = initial message
		if (LogObj.logLevel < depth + 2) {
			return;
		}

		for (let i = 0; i < this._messages.length; i++) {
			let padding = '';
			for (let j = 0; j < depth; j++) {
				if (hasNextMessage[j]) {
					padding += ' |   ';
				} else {
					padding += '     ';
				}
			}

			const message = this._messages[i];

			const timeFiller = new Array(new Date().toLocaleString().length + 2)
				.fill(' ')
				.join('');
			if (i === this._messages.length - 1) {
				LogObj._log(timeFiller, `${padding} \\- `, ...message.content);
				hasNextMessage[depth] = false;
			} else {
				LogObj._log(timeFiller, `${padding} |- `, ...message.content);
				hasNextMessage[depth] = true;
			}

			message.logObj._logMessages(depth + 1, hasNextMessage);
		}
	}

	public static fromIncomingReq(
		req: express.Request,
		res: express.Response
	): LogObj {
		if (LogObj._objMap.has(req)) {
			return LogObj._objMap.get(req)!;
		}
		const obj = new LogObj();
		LogObj._objMap.set(req, obj);
		LogObj._objMap.set(res, obj);

		const start = Date.now();
		const ip = getIP(req);
		res.on('finish', () => {
			if (LogObj.logLevel < 1 || obj.ignore) {
				return;
			}
			const end = Date.now();
			gatherTimings(res);

			const [statusColor, ipBg] = (() => {
				if (res.statusCode === 200) {
					return [chalk.green, chalk.bgGreen];
				} else if (res.statusCode === 500) {
					return [chalk.red, chalk.bgRed];
				} else {
					return [chalk.yellow, chalk.bgYellow];
				}
			})();
			this._log(
				getTime(),
				statusColor(`[${res.statusCode}]`),
				`[${req.method.toUpperCase()}]`,
				ipBg(chalk.black(externalRedact(req.url))),
				'<-',
				chalk.bold(ip ?? '?'),
				`(${end - start} ms)`
			);
			obj._logMessages();
		});

		return obj;
	}

	public attachMessage(...messages: string[]): LogObj {
		if (this._finalized) {
			warning(
				'Attaching message to finalized log object, consider increasing timeout'
			);
			console.trace();
			return LogObj.fromParent();
		}

		const newObj = LogObj.fromParent();
		this._messages.push({
			content: messages,
			logObj: newObj,
		});
		return newObj;
	}

	public reportError(err: Error, config: AppConfig): void {
		const errPath = config.log.errorLogPath;
		if (errPath) {
			// Log error to error path and create it
			const error = `${err.name}: ${err.message}\n${err.stack ?? ''}`;
			const id = `E${generateRandomString(32)}`;
			void fs.appendFile(errPath, `${id}: ${error}\n\n`);
			this.attachMessage(
				`${chalk.red('Error')}: ${err.toString()} (${id})`
			);
		}

		this.attachMessage(
			`${chalk.red('Error')}: ${err.toString()}\n${err.stack ?? ''}`
		);
	}

	public transferTo(target: LogObj): void {
		target._messages = [...target._messages, ...this._messages];
	}
}
