import { attachMessage, logOutgoingReq, log, LogObj } from './logger';
import * as querystring from 'querystring';
import * as http from 'http';
import * as https from 'https';
import chalk from 'chalk';
import { AllModules } from '../modules';
import { ModuleHookables } from '../modules/modules';
import * as url from 'url';

export function wait(time: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, time);
	});
}

export function objToArr<V>(obj: { [key: string]: V }): [string, V][] {
	return Object.keys(obj).map((k) => [k, obj[k]]);
}

export function arrToObj<V>(arr: [string, V][]): {
	[key: string]: V;
} {
	const obj: {
		[key: string]: V;
	} = {};
	for (const [key, val] of arr) {
		obj[key] = val;
	}
	return obj;
}

export async function awaitCondition(
	condition: () => boolean,
	interval: number,
	maxTime = Infinity
): Promise<void> {
	let tests = 0;
	const maxTests = maxTime / interval;

	while (!condition() && tests < maxTests) {
		await wait(interval);
		tests++;
	}
}

export namespace Time {
	export function toTime(timeStr: string): Time {
		const [hours, minutes] = timeStr.split(':');
		return {
			hours: parseInt(hours, 10),
			minutes: parseInt(minutes, 10),
		};
	}

	export interface Time {
		hours: number;
		minutes: number;
	}

	export function dateToTime(date: Date): Time {
		const hours = date.getHours();
		const mins = date.getMinutes();
		return {
			hours,
			minutes: mins,
		};
	}

	function timeToMinutes({ hours, minutes }: Time): number {
		return hours * 60 + minutes;
	}

	export function isInRange(time: Time, from: Time, to: Time): boolean {
		const timeMins = timeToMinutes(time);
		const fromMins = timeToMinutes(from);
		const toMins = timeToMinutes(to);

		if (fromMins > toMins) {
			if (timeMins > fromMins) {
				return true;
			}
			if (timeMins < toMins) {
				return true;
			}
			return false;
		} else {
			if (timeMins < fromMins || timeMins > toMins) {
				return false;
			}
			return true;
		}
	}
}

export function splitIntoGroups<V>(arr: V[], size: number): V[][] {
	const result: V[][] = [];
	for (let i = 0; i < arr.length; i += size) {
		result.push(arr.slice(i, i + size));
	}
	return result;
}

export namespace XHR {
	export function post(
		xhrURL: string,
		name: string,
		params: Record<string, string> = {}
	): Promise<string> {
		return new Promise<string>((resolve) => {
			const qs = Object.keys(params).length
				? `?${querystring.stringify(params)}`
				: '';
			const fullURL = `${xhrURL}${qs}`;
			const parsedURL = new url.URL(fullURL);
			const req = http
				.request(
					{
						hostname: parsedURL.hostname,
						port: 80,
						path: `${parsedURL.pathname}${parsedURL.search}`,
						method: 'POST',
					},
					(res) => {
						let data = '';

						res.on('data', (chunk: string | Buffer) => {
							data += chunk.toString();
						});
						res.on('end', () => {
							attachMessage(
								req,
								chalk.cyan(`[${name}]`),
								xhrURL,
								JSON.stringify(params)
							);
							logOutgoingReq(req, {
								method: 'GET',
								target: xhrURL,
							});
							resolve(data);
						});
					}
				)
				.on('error', (e) => {
					log(
						chalk.red(
							`Error while sending request "${name}" with URL "${xhrURL}": "${e.message}"`
						)
					);
				});
			req.end();
		});
	}

	export function get(
		xhrURL: string,
		name: string,
		params: {
			[key: string]: string;
		} = {}
	): Promise<string> {
		return new Promise<string>((resolve) => {
			const parsedURL = new url.URL(xhrURL);
			let basePackage: typeof http | typeof https | null = null;
			if (parsedURL.protocol === 'https:') {
				basePackage = https;
			} else if (parsedURL.protocol === 'http:') {
				basePackage = http;
			} else {
				throw new Error(`Unknown protocol: "${parsedURL.protocol}"`);
			}

			const qs = Object.keys(params).length
				? `?${querystring.stringify(params)}`
				: '';
			const fullURL = `${xhrURL}${qs}`;
			const req = basePackage
				.get(fullURL, (res) => {
					let data = '';

					res.on('data', (chunk: string | Buffer) => {
						data += chunk.toString();
					});
					res.on('end', () => {
						attachMessage(
							req,
							chalk.cyan(`[${name}]`),
							xhrURL,
							JSON.stringify(params)
						);
						logOutgoingReq(req, {
							method: 'GET',
							target: xhrURL,
						});
						resolve(data);
					});
				})
				.on('error', (e) => {
					log(
						chalk.red(
							`Error while sending request "${name}" with URL "${xhrURL}": "${e.message}"`
						)
					);
				});
		});
	}
}

const CHARS =
	'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'.split('');
export function generateRandomString(length = 64): string {
	let str = '';
	for (let i = 0; i < length; i++) {
		str += CHARS[Math.floor(CHARS.length * Math.random())];
	}
	return str;
}

export function flatten<V>(arr: V[][]): V[];
export function flatten<V>(arr: V[]): V[];
export function flatten<V>(arr: V[][] | V[]): V[] {
	const flattened: V[] = [];
	for (const value of arr) {
		if (Array.isArray(value)) {
			flattened.push(...flatten<V>(value as unknown as V[][]));
		} else {
			flattened.push(value);
		}
	}
	return flattened;
}

export class SettablePromise<V> {
	private _isSet = false;
	private _resolver!: (value: V) => void;
	private _promise = new Promise<V>((resolve) => {
		this._resolver = resolve;
	});

	set(value: V): void {
		this._resolver(value);
		this._isSet = true;
	}

	get isSet(): boolean {
		return this._isSet;
	}

	get value(): Promise<V> {
		return this._promise;
	}
}

export function createHookables(
	modules: AllModules,
	sourceName: string,
	hookName: string,
	logObj: LogObj
): ModuleHookables {
	return arrToObj(
		Object.keys(modules).map((name: keyof AllModules) => {
			const moduleMeta = modules[name];
			const Handler = moduleMeta.External;
			return [name, new Handler(logObj, `${sourceName}.${hookName}`)];
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		}) as any
	) as unknown as ModuleHookables;
}

export function flatMap<I, R>(arr: I[], map: (item: I) => R | R[]): R[] {
	const result: R[] = [];
	for (const item of arr) {
		const mapped = map(item);
		const flattened = Array.isArray(mapped) ? flatten(mapped) : [mapped];
		result.push(...flattened);
	}
	return result;
}

export function fromEntries<V>(entries: [string, V][]): {
	[key: string]: V;
} {
	const obj: {
		[key: string]: V;
	} = {};
	for (const [key, value] of entries) {
		obj[key] = value;
	}
	return obj;
}

/**
 * Batch multiple calls in a short time into
 * a single call
 */
export class Batcher<D> {
	private _minWaitTime: number;
	private _maxWaitTime: number;
	private _onDispatch: (data: D[]) => void;
	private _data: D[] = [];

	private _currentBatchMinTimer: NodeJS.Timeout | null = null;
	private _currentBatchMaxTimer: NodeJS.Timeout | null = null;

	constructor({
		maxWaitTime,
		minWaitTime,
		onDispatch,
	}: {
		/**
		 * The minimum time to wait after a call
		 * for another call
		 */
		minWaitTime: number;
		/**
		 * The maximum time to wait since the first
		 * call before dispatching
		 */
		maxWaitTime: number;
		/**
		 * A function to call with the collected data
		 */
		onDispatch(data: D[]): void;
	}) {
		this._minWaitTime = minWaitTime;
		this._maxWaitTime = maxWaitTime;
		this._onDispatch = onDispatch;
	}

	private _createDispatchTimer(duration: number) {
		return setTimeout(() => {
			this._dispatch();
		}, duration);
	}

	private _markFirstCall() {
		this._currentBatchMaxTimer = this._createDispatchTimer(
			this._maxWaitTime
		);
	}

	private _clearTimer(timer: NodeJS.Timeout | null) {
		if (timer) {
			clearTimeout(timer);
		}
	}

	private _dispatch() {
		this._clearTimer(this._currentBatchMinTimer);
		this._clearTimer(this._currentBatchMaxTimer);

		this._onDispatch(this._data);
		this._data = [];
	}

	call(data: D): void {
		if (this._data.length === 0) {
			this._markFirstCall();
		}
		this._data.push(data);

		this._clearTimer(this._currentBatchMinTimer);
		this._currentBatchMinTimer = this._createDispatchTimer(
			this._minWaitTime
		);
	}
}

export function pad(str: string, length: number, padChar: string): string {
	while (str.length < length) {
		str = `${padChar}${str}`;
	}
	return str;
}

export function optionalArrayValue<V>(
	condition: boolean,
	value: V
): V[] | never[] {
	return condition ? [value] : [];
}
