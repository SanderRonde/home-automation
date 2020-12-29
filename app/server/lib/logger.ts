import { ExplainHook } from '../modules/explain';
import { ResponseLike } from '../modules/multi';
import { IP_LOG_VERSION } from './constants';
import { Auth } from '../modules/auth';
import { Response } from 'node-fetch';
import * as express from 'express';
import * as http from 'http';
import chalk from 'chalk';

interface AssociatedMessage {
	content: string[];
}

const msgMap: WeakMap<
	ResponseLike | AssociatedMessage | {},
	AssociatedMessage[]
> = new WeakMap();
const ignoredMap: WeakSet<
	ResponseLike | AssociatedMessage | {}
> = new WeakSet();
const rootMap: WeakMap<
	any,
	ResponseLike | AssociatedMessage | {}
> = new WeakMap();
const logListeners: WeakMap<
	any,
	(captured: LogCapturer) => void
> = new WeakMap();

let logLevel: number = 1;
export function setLogLevel(level: number) {
	logLevel = level;
}

export function getLogLevel() {
	return logLevel;
}

function setDefaultArrValues<T>(arr: T[], len: number, value: T): T[] {
	for (let i = 0; i < len; i++) {
		arr[i] = arr[i] || value;
	}
	arr.splice(len);
	return arr;
}

interface Loggable {
	log(message?: any, ...optionalParams: any[]): void;
}

function checkForLogListeners(logObj: any, target: LogCapturer) {
	if (logListeners.has(logObj)) {
		logListeners.get(logObj)!(target);
	}
}

function logAssociatedMessages(
	target: LogCapturer,
	messages: AssociatedMessage[],
	indent: number = 0,
	hasNextMessage: boolean[] = []
) {
	if (logLevel < indent + 2) return;

	for (let i = 0; i < messages.length; i++) {
		const padding = setDefaultArrValues(hasNextMessage, indent, false)
			.map(next => {
				if (next) {
					return ' |   ';
				} else {
					return '     ';
				}
			})
			.join('');
		const message = messages[i];
		checkForLogListeners(message, target);
		const timeFiller = getTimeFiller();
		if (i === messages.length - 1) {
			target.log(timeFiller, `${padding} \\- `, ...message.content);
			hasNextMessage[indent] = false;
		} else {
			target.log(timeFiller, `${padding} |- `, ...message.content);
			hasNextMessage[indent] = true;
		}
		logAssociatedMessages(
			target,
			msgMap.get(message) || [],
			indent + 1,
			hasNextMessage
		);
	}
}

interface RequestLike {
	url?: string;
	method?: string;
	ip?: string;
	headers: {
		[key: string]: any;
	};
}

function getIP(req: RequestLike) {
	const fwd = req.headers['x-forwarded-for'];
	if (Array.isArray(fwd)) {
		return fwd[0];
	}
	if (typeof fwd === 'string' && fwd.includes(',')) {
		const [ipv4, ipv6] = fwd.split(',');
		return IP_LOG_VERSION === 'ipv4' ? ipv4 : ipv6;
	}
	return fwd || req.ip;
}

export function genURLLog({
	req = {
		headers: {}
	},
	url = req.url || '?',
	method = req.method || '?',
	statusCode = 200,
	duration = '?',
	ip = getIP(req) || '?',
	isSend = false
}: {
	req?: RequestLike;
	method?: string;
	url?: string;
	statusCode?: number;
	duration?: number | string;
	ip?: string;
	isSend?: boolean;
}) {
	const [statusColor, ipBg] = (() => {
		if (statusCode === 200) {
			return [chalk.green, chalk.bgGreen];
		} else if (statusCode === 500) {
			return [chalk.red, chalk.bgRed];
		} else {
			return [chalk.yellow, chalk.bgYellow];
		}
	})();
	return [
		statusColor(`[${statusCode}]`),
		`[${method.toUpperCase()}]`,
		ipBg(chalk.black(Auth.Secret.redact(url))),
		`${isSend ? '->' : '<-'}`,
		chalk.bold(ip),
		`(${duration} ms)`
	];
}

export class LogCapturer implements Loggable {
	private _done: boolean = false;
	private _onDone: ((result: string) => void)[] = [];

	private _lines: string[] = [];
	private _originalLines: any[][] = [];

	private _logToLine(...params: any[]) {
		this._lines.push(
			params
				.map(param => {
					if (typeof param === 'string') return param;
					if (typeof param === 'number') return param + '';
					return JSON.stringify(param);
				})
				.join(' ')
		);
		this._originalLines.push(params);
	}

	log(message?: any, ...params: any[]) {
		this._logToLine(message, ...params);
	}

	private _get() {
		return this._lines.join('\n');
	}

	async get(): Promise<string> {
		if (this._done) {
			return this._get();
		}
		return new Promise(resolve => {
			this._onDone.push(result => {
				resolve(result);
			});
		});
	}

	logToConsole() {
		for (const line of this._originalLines) {
			console.log(...line);
		}
		this._done = true;
		const str = this._get();
		this._onDone.forEach(fn => fn(str));
	}
}

export function logReq(req: express.Request, res: express.Response) {
	const target = new LogCapturer();

	const start = Date.now();
	const ip = getIP(req);
	res.on('finish', async () => {
		checkForLogListeners(res, target);

		if (logLevel < 1 || ignoredMap.has(res)) {
			target.logToConsole();
			return;
		}

		const end = Date.now();
		target.log(
			getTime(),
			...genURLLog({
				req,
				statusCode: res.statusCode,
				duration: end - start,
				ip
			})
		);

		// Log attached messages
		if (logLevel >= 2 && msgMap.has(res)) {
			logAssociatedMessages(target, msgMap.get(res)!);
		}
		target.logToConsole();
	});
}

export function getTime() {
	return chalk.bold(`[${new Date().toLocaleString()}]`);
}

function getTimeFiller() {
	return new Array(new Date().toLocaleString().length + 2).fill(' ').join('');
}

export function logOutgoingRes(
	res: Response,
	data: {
		method: string;
		path: string;
	}
) {
	const target = new LogCapturer();
	if (logListeners.has(res)) {
		logListeners.get(res)!(target);
	}
	checkForLogListeners(res, target);

	if (logLevel < 1) {
		target.logToConsole();
		return;
	}

	target.log(
		getTime(),
		...genURLLog({
			ip: data.path,
			method: data.method,
			url: data.path,
			isSend: true
		})
	);

	// Log attached messages
	if (logLevel >= 2 && msgMap.has(res)) {
		logAssociatedMessages(target, msgMap.get(res)!);
	}
	target.logToConsole();
}

export function logOutgoingReq(
	req: http.ClientRequest,
	data: {
		method: string;
		target: string;
	}
) {
	const target = new LogCapturer();
	if (logListeners.has(req)) {
		logListeners.get(req)!(target);
	}
	checkForLogListeners(req, target);

	const ip = req.path;

	if (logLevel < 1) {
		target.logToConsole();
		return;
	}

	target.log(
		getTime(),
		...genURLLog({
			ip: data.target,
			method: data.method,
			url: ip,
			isSend: true
		})
	);

	// Log attached messages
	if (logLevel >= 2 && msgMap.has(req)) {
		logAssociatedMessages(target, msgMap.get(req)!);
	}
	target.logToConsole();
}

export function logFixture(
	obj: ResponseLike | AssociatedMessage | {},
	...name: string[]
) {
	const target = new LogCapturer();
	checkForLogListeners(obj, target);

	target.log(getTime(), ...name);

	// Log attached messages
	// Log attached messages
	if (logLevel >= 2 && msgMap.has(obj)) {
		logAssociatedMessages(target, msgMap.get(obj)!);
	}
	target.logToConsole();
}

export function transferAttached(
	from: ResponseLike | AssociatedMessage | {},
	to: ResponseLike | AssociatedMessage | {}
) {
	const attached = msgMap.get(from) || [];
	if (!msgMap.has(to)) {
		msgMap.set(to, []);
	}

	const messages = msgMap.get(to)!;
	messages.push(...attached);

	msgMap.set(to, messages);
	msgMap.delete(from);

	rootMap.set(to, rootMap.get(from)!);
	if (logListeners.has(from)) {
		logListeners.set(to, logListeners.get(from)!);
		logListeners.delete(from);
	}
}

export function disableMessages(obj: ResponseLike | AssociatedMessage | {}) {
	ignoredMap.add(obj);
}

export function attachMessage(
	obj: ResponseLike | AssociatedMessage | {},
	...messages: string[]
) {
	if (typeof obj !== 'object' && typeof obj !== 'function') {
		console.warn('Invalid log target', obj);
		console.trace();
		return {};
	}
	if (!msgMap.has(obj)) {
		msgMap.set(obj, []);
	}

	const prevMessages = msgMap.get(obj)!;
	const msg: AssociatedMessage = {
		content: messages
	};
	prevMessages.push(msg);

	if (!rootMap.has(obj)) {
		rootMap.set(obj, obj);
	}
	rootMap.set(msg, rootMap.get(obj)!);
	return msg;
}

export function attachSourcedMessage(
	obj: ResponseLike | AssociatedMessage | {},
	source: string,
	hook: ExplainHook | null,
	...messages: string[]
) {
	if (typeof obj !== 'object' && typeof obj !== 'function') {
		console.warn('Invalid log target', obj);
		console.trace();
		return {};
	}
	if (!msgMap.has(obj)) {
		msgMap.set(obj, []);
	}

	if (hook) {
		hook(messages.join(' '), source, obj);
	}

	const prevMessages = msgMap.get(obj)!;
	const msg: AssociatedMessage = {
		content: messages
	};
	prevMessages.push(msg);

	if (!rootMap.has(obj)) {
		rootMap.set(obj, obj);
	}
	rootMap.set(msg, rootMap.get(obj)!);
	return msg;
}

export function addLogListener(
	obj: any,
	listener: (captured: LogCapturer) => void
) {
	if (typeof obj !== 'object' || !obj) return;

	logListeners.set(obj, listener);
}

export function getRootLogObj(obj: any) {
	if (typeof obj !== 'object' || !obj) return;
	return rootMap.get(obj);
}

export class ResDummy implements ResponseLike {
	status() {
		return this;
	}
	write() {}
	end() {}
	contentType() {}
	cookie() {}

	transferTo(obj: ResponseLike | AssociatedMessage | {}) {
		transferAttached(this, obj);
	}
	_headersSent = false;
}

export class ProgressLogger {
	private _progress: number = 0;
	private _startTime = Date.now();

	constructor(private _name: string, private _max: number) {}

	private _getProgressBar() {
		if (this._max - this._progress < 0) {
			console.log(
				chalk.red('Increment got called more often than configured')
			);
		}
		return `[${new Array(this._progress).fill('*').join('')}${new Array(
			this._max - this._progress
		)
			.fill(' ')
			.join('')}]`;
	}

	logInitial() {
		console.log(
			chalk.bgBlack(
				getTime(),
				chalk.bgBlack(
					chalk.bold(
						chalk.white(`${this._name}: ${this._getProgressBar()}`)
					)
				)
			)
		);
	}

	increment(name: string) {
		this._progress++;
		console.log(
			chalk.bgBlack(
				getTime(),
				chalk.bgBlack(
					chalk.bold(
						chalk.white(
							`${this._name}: ${this._getProgressBar()} - `
						),
						chalk.green('✔'),
						chalk.white(name)
					)
				)
			)
		);
	}

	done() {
		if (this._progress > this._max) {
			console.log(
				chalk.red('Increment got called more often than configured')
			);
		} else if (this._progress < this._max) {
			console.log(
				chalk.red('Increment got called less times than configured')
			);
		}

		console.log(
			chalk.bgBlack(
				getTime(),
				chalk.bgBlack(
					chalk.bold(
						`Done loading ${this._name} in ${Date.now() -
							this._startTime}ms`
					)
				)
			)
		);
	}
}

let isInit: boolean = false;
let initMessages: any[][] = [];
export function startInit() {
	isInit = true;
}

export function endInit() {
	isInit = false;
	initMessages.forEach(args => {
		console.log(...args);
	});
}

export function logFirst(...args: any[]) {
	if (isInit) {
		initMessages = [args, ...initMessages];
	} else {
		console.log(...args);
	}
}

export function log(...args: any[]) {
	if (isInit) {
		initMessages.push(args);
	} else {
		console.log(...args);
	}
}

export function logTimed(...args: any[]) {
	if (isInit) {
		initMessages.push([...getTime(), args]);
	} else {
		console.log(...[getTime(), ...args]);
	}
}
