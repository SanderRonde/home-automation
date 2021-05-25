import { IP_LOG_VERSION } from './constants';
import * as express from 'express';
import * as http from 'http';
import chalk from 'chalk';
import { ExplainHook } from '../modules/explain/types';
import { externalRedact } from '../modules/auth/helpers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LogObj = any;

interface AssociatedMessage {
	content: string[];
}

const msgMap: WeakMap<
	| http.ClientRequest
	| ResponseLike
	| AssociatedMessage
	| Record<string, unknown>,
	AssociatedMessage[]
> = new WeakMap();
const ignoredMap: WeakSet<
	ResponseLike | AssociatedMessage | Record<string, unknown>
> = new WeakSet();
const rootMap: WeakMap<
	LogObj,
	ResponseLike | AssociatedMessage | Record<string, unknown>
> = new WeakMap();
const logListeners: WeakMap<LogObj, (captured: LogCapturer) => void> =
	new WeakMap();

let logLevel = 1;
export function setLogLevel(level: number): void {
	logLevel = level;
}

export function getLogLevel(): number {
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
	log(message?: unknown, ...optionalParams: unknown[]): void;
}

function checkForLogListeners(logObj: LogObj, target: LogCapturer) {
	if (logListeners.has(logObj)) {
		logListeners.get(logObj)!(target);
	}
}

function logAssociatedMessages(
	target: LogCapturer,
	messages: AssociatedMessage[],
	indent = 0,
	hasNextMessage: boolean[] = []
) {
	if (logLevel < indent + 2) {
		return;
	}

	for (let i = 0; i < messages.length; i++) {
		const padding = setDefaultArrValues(hasNextMessage, indent, false)
			.map((next) => {
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
		[key: string]: string | string[];
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
		headers: {},
	},
	url = req.url || '?',
	method = req.method || '?',
	statusCode = 200,
	duration = '?',
	ip = getIP(req) || '?',
	isSend = false,
}: {
	req?: RequestLike;
	method?: string;
	url?: string;
	statusCode?: number;
	duration?: number | string;
	ip?: string;
	isSend?: boolean;
}): string[] {
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
		ipBg(chalk.black(externalRedact(url))),
		`${isSend ? '->' : '<-'}`,
		chalk.bold(ip),
		`(${duration} ms)`,
	];
}

export class LogCapturer implements Loggable {
	private _done = false;
	private _onDone: ((result: string) => void)[] = [];

	private _lines: string[] = [];
	private _originalLines: unknown[][] = [];

	private _logToLine(...params: unknown[]) {
		this._lines.push(
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
		this._originalLines.push(params);
	}

	log(message?: unknown, ...params: unknown[]): void {
		this._logToLine(message, ...params);
	}

	private _get() {
		return this._lines.join('\n');
	}

	async get(): Promise<string> {
		if (this._done) {
			return this._get();
		}
		return new Promise((resolve) => {
			this._onDone.push((result) => {
				resolve(result);
			});
		});
	}

	logToConsole(): void {
		for (const line of this._originalLines) {
			console.log(...line);
		}
		this._done = true;
		const str = this._get();
		this._onDone.forEach((fn) => fn(str));
	}
}

export function logReq(req: RequestLike | LogObj, res: express.Response): void {
	const target = new LogCapturer();

	const start = Date.now();
	const ip = getIP(req);
	res.on('finish', () => {
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
				ip,
			})
		);

		// Log attached messages
		if (logLevel >= 2 && msgMap.has(res)) {
			logAssociatedMessages(target, msgMap.get(res)!);
		}
		target.logToConsole();
	});
}

export function getTime(): string {
	return chalk.bold(`[${new Date().toLocaleString()}]`);
}

function getTimeFiller() {
	return new Array(new Date().toLocaleString().length + 2).fill(' ').join('');
}

export function logOutgoingRes(
	res: ResponseLike | LogObj,
	data: {
		method: string;
		path: string;
	}
): void {
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
			isSend: true,
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
): void {
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
			isSend: true,
		})
	);

	// Log attached messages
	if (logLevel >= 2 && msgMap.has(req)) {
		logAssociatedMessages(target, msgMap.get(req)!);
	}
	target.logToConsole();
}

export function logFixture(
	obj: ResponseLike | AssociatedMessage | Record<string, unknown>,
	...name: string[]
): void {
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
	from: ResponseLike | AssociatedMessage | Record<string, unknown>,
	to: ResponseLike | AssociatedMessage | Record<string, unknown>
): void {
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

export function disableMessages(
	obj: ResponseLike | AssociatedMessage | Record<string, unknown>
): void {
	ignoredMap.add(obj);
}

export function attachMessage(
	obj: ResponseLike | AssociatedMessage | Record<string, unknown> | LogObj,
	...messages: string[]
): LogObj {
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
		content: messages,
	};
	prevMessages.push(msg);

	if (!rootMap.has(obj)) {
		rootMap.set(obj, obj);
	}
	rootMap.set(msg, rootMap.get(obj)!);
	return msg;
}

export function attachSourcedMessage(
	obj: ResponseLike | AssociatedMessage | Record<string, unknown>,
	source: string,
	hook: ExplainHook | null,
	...messages: string[]
): LogObj {
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
		content: messages,
	};
	prevMessages.push(msg);

	if (!rootMap.has(obj)) {
		rootMap.set(obj, obj);
	}
	rootMap.set(msg, rootMap.get(obj)!);
	return msg;
}

export function addLogListener(
	obj: LogObj,
	listener: (captured: LogCapturer) => void
): void {
	if (typeof obj !== 'object' || !obj) {
		return;
	}

	logListeners.set(obj, listener);
}

export function getRootLogObj(obj: LogObj): LogObj {
	if (typeof obj !== 'object' || !obj) {
		return;
	}
	return rootMap.get(obj);
}

export interface ResponseLike {
	status(code: number): this;
	redirect(url: string, status?: number): void;
	write(str: string): void;
	sendFile(path: string): void;
	end(): void;
	contentType(type: string): void;
	cookie(name: string, value: string, options?: express.CookieOptions): void;
	_headersSent?: boolean;
}

export class ResDummy implements ResponseLike {
	status(): this {
		return this;
	}
	sendFile(): void {}
	redirect(): void {}
	write(): void {}
	end(): void {}
	contentType(): void {}
	cookie(): void {}

	transferTo(
		obj: ResponseLike | AssociatedMessage | Record<string, unknown>
	): void {
		transferAttached(this, obj);
	}
	_headersSent = false;
}

export class ProgressLogger {
	private _progress = 0;
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

	logInitial(): void {
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

	increment(name: string): void {
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

	done(): void {
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
						`Done loading ${this._name} in ${
							Date.now() - this._startTime
						}ms`
					)
				)
			)
		);
	}
}

let isInit = false;
let initMessages: unknown[][] = [];
export function startInit(): void {
	isInit = true;
}

export function endInit(): void {
	isInit = false;
	initMessages.forEach((args) => {
		console.log(...args);
	});
}

export function logFirst(...args: unknown[]): void {
	if (isInit) {
		initMessages = [args, ...initMessages];
	} else {
		console.log(...args);
	}
}

export function log(...args: unknown[]): void {
	if (isInit) {
		initMessages.push(args);
	} else {
		console.log(...args);
	}
}

export function logTimed(...args: unknown[]): void {
	if (isInit) {
		initMessages.push([...getTime(), args]);
	} else {
		console.log(...[getTime(), ...args]);
	}
}

const chalkColors = [
	'black',
	'red',
	'green',
	'yellow',
	'blue',
	'magenta',
	'cyan',
	'white',
	'gray',
	'grey',
	'blackBright',
	'redBright',
	'greenBright',
	'yellowBright',
	'blueBright',
	'magentaBright',
	'cyanBright',
	'whiteBright',
] as const;
export function logTag(
	tag: string,
	color: typeof chalkColors[Extract<keyof typeof chalkColors, number>],
	...messages: unknown[]
): void {
	log(getTime(), chalk[color](`[${tag}]`), ...messages);
}

export function debug(...messages: unknown[]): void {
	log(getTime(), chalk.bgHex('fc8803')('[DEBUG]'), ...messages);
}

export function warning(...messages: unknown[]): void {
	log(getTime(), chalk.bgRed('[WARNING]'), ...messages);
}
