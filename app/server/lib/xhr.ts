import { LogObj } from './logging/lob-obj';
import { warning } from './logging/logger';
import * as querystring from 'querystring';
import * as https from 'https';
import { wait } from './time';
import * as http from 'http';
import * as url from 'url';
import chalk from 'chalk';

export class XHR {
	private static _queue: Promise<unknown> = Promise.resolve();

	private static async _enqueue<T>(fn: () => Promise<T>): Promise<T> {
		this._queue = this._queue.then(() => Promise.race([fn(), wait(10000)]));
		return this._queue as Promise<T>;
	}

	public static post(
		xhrURL: string,
		name: string,
		params: Record<string, string> = {},
		options?: {
			port?: number;
			headers?: Record<string, string>;
		}
	): Promise<string | null> {
		return this._enqueue(
			() =>
				new Promise<string | null>((resolve) => {
					const qs = Object.keys(params).length
						? `?${querystring.stringify(params)}`
						: '';
					const fullURL = `${xhrURL}${qs}`;
					const parsedURL = new url.URL(fullURL);
					const req = http
						.request(
							{
								hostname: parsedURL.hostname,
								port: options?.port ?? (parsedURL.protocol === 'https:' ? 443 : 80),
								path: `${parsedURL.pathname}${parsedURL.search}`,
								method: 'POST',
								headers: {
									'Content-Type': 'application/json',
									...options?.headers,
								},
							},
							(res) => {
								let data = '';

								res.on('data', (chunk: string | Buffer) => {
									data += chunk.toString();
								});
								res.on('end', () => {
									logObj.attachMessage(
										chalk.cyan(`[${name}]`),
										xhrURL,
										JSON.stringify(params)
									);
									resolve(data);
								});
							}
						)
						.on('error', (e) => {
							warning(
								`Error while sending request "${name}" with URL "${xhrURL}": "${e.message}"`
							);
							resolve(null);
						});
					const logObj = LogObj.fromOutgoingReq(req);
					if (Object.values(params).length) {
						req.write(JSON.stringify(params));
					}
					req.end();
				})
		);
	}

	public static get(
		xhrURL: string,
		name: string,
		params: {
			[key: string]: string;
		} = {},
		options?: {
			port?: number;
			headers?: Record<string, string>;
		}
	): Promise<string | null> {
		return new Promise<string | null>((resolve) => {
			const parsedURL = new url.URL(xhrURL);
			let basePackage: typeof http | typeof https | null = null;
			if (parsedURL.protocol === 'https:') {
				basePackage = https;
			} else if (parsedURL.protocol === 'http:') {
				basePackage = http;
			} else {
				throw new Error(`Unknown protocol: "${parsedURL.protocol}"`);
			}

			const qs = Object.keys(params).length ? `?${querystring.stringify(params)}` : '';
			const fullURL = `${xhrURL}${qs}`;
			const req = basePackage
				.get(
					fullURL,
					{
						port: options?.port ?? (parsedURL.protocol === 'https:' ? 443 : 80),
						headers: options?.headers,
					},
					(res) => {
						let data = '';

						res.on('data', (chunk: string | Buffer) => {
							data += chunk.toString();
						});
						res.on('end', () => {
							logObj.attachMessage(
								chalk.cyan(`[${name}]`),
								xhrURL,
								JSON.stringify(params)
							);
							resolve(data);
						});
					}
				)
				.on('error', (e) => {
					warning(
						`Error while sending request "${name}" with URL "${xhrURL}": "${e.message}"`
					);
					resolve(null);
				});
			const logObj = LogObj.fromOutgoingReq(req);
		});
	}
}
