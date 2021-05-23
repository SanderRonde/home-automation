import { attachMessage, logOutgoingReq, log, LogObj } from './logger';
import * as querystring from 'querystring';
import * as http from 'http';
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
			const qs = Object.keys(params).length
				? `?${querystring.stringify(params)}`
				: '';
			const fullURL = `${xhrURL}${qs}`;
			const req = http
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

export function flatten<V>(arr: V[][]): V[] {
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
			return [
				name,
				new modules[name].meta.external.Handler(
					logObj,
					`${sourceName}.${hookName}`
				),
			];
		})
	) as unknown as ModuleHookables;
}
