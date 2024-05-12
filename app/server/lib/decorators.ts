/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/prefer-optional-chain */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import {
	externalAuthenticate,
	externalCheckCookie,
} from '../modules/auth/helpers';
import { KeyError, AuthError } from './errors';
import { attachMessage } from './logger';
import * as express from 'express';
import chalk from 'chalk';

export function requireParams(...keys: string[]) {
	return function <
		T,
		F extends (
			this: T,
			res: express.Response,
			params: any,
			...args: unknown[]
		) => unknown,
	>(target: F, _context: ClassMethodDecoratorContext<T, F>) {
		return function (res: express.Response, params: any, ...args: any[]) {
			for (const key of keys) {
				if (!params || !params[key]) {
					throw new KeyError(`Missing key "${key}"`);
				}
			}

			return target.bind(this)(res, params, ...args);
		} as F;
	};
}

export function auth<
	T,
	F extends (
		this: T,
		res: express.Response,
		params: any,
		...args: unknown[]
	) => unknown,
>(target: F, context: ClassMethodDecoratorContext<T, F>) {
	requireParams('auth')(target, context);

	return function (
		this: T,
		res: express.Response,
		params: any,
		...args: any[]
	) {
		if (!externalAuthenticate(params.auth, params.id || '0')) {
			throw new AuthError('Invalid auth key');
		}

		return target.bind(this)(res, params, ...args);
	} as F;
}

export function authCookie<
	T,
	F extends (
		this: T,
		res: express.Response,
		req: {
			cookies: {
				[key: string]: string;
			};
		},
		...args: unknown[]
	) => unknown,
>(target: F, _context: ClassMethodDecoratorContext<T, F>) {
	return function (
		this: T,
		res: express.Response,
		req: {
			cookies: {
				[key: string]: string;
			};
		},
		...args: any[]
	) {
		if (!externalCheckCookie(req)) {
			throw new AuthError('Invalid or missing auth cookie');
		}

		return target.bind(this)(res, req, ...args);
	} as F;
}

export function authAll<
	T,
	F extends (
		this: T,
		res: express.Response,
		params: any,
		...args: unknown[]
	) => unknown,
>(target: F, _context: ClassMethodDecoratorContext<T, F>) {
	return function (
		this: T,
		res: express.Response,
		params: any,
		...args: Parameters<F>
	): ReturnType<F> {
		if (
			params.cookies &&
			externalCheckCookie({ cookies: params.cookies })
		) {
			return target.bind(this)(res, params, ...args) as ReturnType<F>;
		} else if (params.cookies && params.cookies['key']) {
			throw new AuthError('Invalid auth cookie');
		}

		if (!params || !params['auth']) {
			throw new KeyError('Missing key "auth"');
		}
		if (externalAuthenticate(params.auth, params.id || '0')) {
			return target.bind(this)(res, params, ...args) as ReturnType<F>;
		} else {
			throw new AuthError('Invalid auth key');
		}
	} as F;
}

export function errorHandle<
	T,
	F extends (this: T, res: express.Response, ...args: unknown[]) => unknown,
>(target: F, _context: ClassMethodDecoratorContext<T, F>) {
	return async function (
		this: T,
		res: express.Response,
		...args: Parameters<F>
	): Promise<any> {
		try {
			return (await target.bind(this)(res, ...args)) as ReturnType<F>;
		} catch (e) {
			if (e instanceof KeyError) {
				res.status(400).write(e.message);
			} else if (e instanceof AuthError) {
				res.status(403).write(e.message);
			} else {
				const msg = attachMessage(
					res,
					chalk.red(chalk.bgBlack(e?.message || '?'))
				);
				for (const line of e?.stack?.split('\n') || []) {
					attachMessage(msg, line);
				}
				res.status(500).write('Internal server error');
			}
			res.end();
		}
	} as F;
}

export function upgradeToHTTPS<
	T,
	F extends (
		this: T,
		res: express.Response,
		req: express.Request,
		...args: unknown[]
	) => unknown,
>(target: F, _context: ClassMethodDecoratorContext<T, F>) {
	return async function (
		this: T,
		res: express.Response,
		req: express.Request,
		...args: any[]
	) {
		const protocol = (() => {
			if ('x-forwarded-proto' in req.headers) {
				// Should only be used if the proxy is trusted but mine is
				const proto = req.headers['x-forwarded-proto'];
				if (Array.isArray(proto)) {
					return proto[0];
				} else if (typeof proto === 'string') {
					return proto.split(',')[0];
				}
			}
			return req.protocol;
		})();

		if (protocol === 'http') {
			res.redirect(`https://${req.headers.host}${req.url}`);
			return;
		}

		return target.bind(this)(res, req, ...args);
	} as F;
}
