import { transferAttached, genURLLog, attachMessage } from '../lib/logger';
import { AppWrapper } from '../lib/routes';
import { ModuleConfig } from './all';
import { ModuleMeta } from './meta';
import * as express from 'express';

interface MultiRequestRequest {
	path: string;
	body: {
		[key: string]: string;
	};
	method: string;
}

export interface ResponseLike {
	status(code: number): this;
	write(str: string): void;
	end(): void;
	contentType(type: string): void;
	cookie(name: string, value: string, options?: express.CookieOptions): void;
}

export class SubDummy implements ResponseLike {
	private _status: number = 200;
	private _contentType: string | null = null;
	private _cookies: [string, string][] = [];
	private _written: string = '';
	private _start: number = Date.now();
	private _duration: string | number = '?';

	constructor(private _config: MultiRequestRequest) {}

	status(code: number) {
		this._status = code;
		return this;
	}

	write(str: string) {
		this._written = str;
	}

	end() {
		this._duration = Date.now() - this._start;
	}

	contentType(type: string) {
		this._contentType = type;
	}

	cookie(name: string, value: string) {
		this._cookies.push([name, value]);
	}

	get data() {
		return {
			status: this._status,
			contentType: this._contentType,
			cookies: this._cookies,
			written: this._written,
			start: this._start,
			duration: this._duration,
			config: this._config
		};
	}
}

class ResponseDummy {
	private _dummies: SubDummy[] = [];

	constructor(private _res: express.Response) {}

	response(config: MultiRequestRequest) {
		const dummy = new SubDummy(config);
		this._dummies.push(dummy);
		return dummy;
	}

	finish(req: express.Request) {
		this._res.status(
			this._dummies
				.map(d => d.data.status)
				.reduce((prev, current) => {
					if (current !== 200) return current;
					return prev;
				}, 200)
		);
		this._res.write(JSON.stringify(this._dummies.map(d => d.data.written)));
		const contentType = this._dummies
			.map(d => d.data.contentType)
			.reduce((prev, current) => {
				return prev || current;
			}, null);
		if (contentType) {
			this._res.contentType(contentType);
		}
		for (const [key, val] of this._dummies
			.map(d => d.data.cookies)
			.reduce((prev, current) => {
				return [...prev, ...current];
			}, [])) {
			this._res.cookie(key, val);
		}

		for (const dummy of this._dummies) {
			const subRes = attachMessage(
				this._res,
				...genURLLog({
					req,
					statusCode: dummy.data.status,
					duration: dummy.data.duration,
					ip: req.ip,
					method: dummy.data.config.method,
					url: dummy.data.config.path
				})
			);
			transferAttached(dummy, subRes);
		}

		transferAttached(this, this._res);

		this._res.end();
	}
}

export namespace Multi {
	export const meta = new (class Meta extends ModuleMeta {
		name = 'multi';

		async init(config: ModuleConfig) {
			Routing.init(config);
		}
	})();

	export namespace Routing {
		export function init({ app }: { app: AppWrapper }) {
			app.app.post('/multi', async (req, res) => {
				const { requests } = req.body as {
					requests: MultiRequestRequest[];
				};
				if (!requests || !Array.isArray(requests)) {
					res.status(400).write('No routes given');
					res.end();
					return;
				}

				// Validate them all
				for (const route of requests) {
					if (
						typeof route !== 'object' ||
						!route.path ||
						typeof route.path !== 'string' ||
						!route.body ||
						typeof route.body !== 'object'
					) {
						res.status(400).write(
							'Invalid route format. Expected is { method: string, path: string, body: {} }'
						);
						res.end();
						return;
					}
				}

				const resDummy = new ResponseDummy(res);
				await Promise.all(
					requests.map(config => {
						const { body, path, method } = config;
						return app.triggerRoute(
							req,
							resDummy.response(config),
							method,
							path,
							body
						);
					})
				);
				resDummy.finish(req);
			});
		}
	}
}
