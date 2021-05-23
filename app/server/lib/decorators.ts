/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { KeyError, AuthError } from './errors';
import { attachMessage } from './logger';
import { Auth } from '../modules/auth';
import * as express from 'express';
import chalk from 'chalk';

interface KeyVal {
	[key: string]: string;
}

export function requireParams(...keys: string[]) {
	return function (
		_target: unknown,
		_propertyKey: string,
		descriptor: PropertyDescriptor
	): void {
		// eslint-disable-next-line @typescript-eslint/ban-types
		const original = descriptor.value as Function;
		descriptor.value = function (
			res: express.Response,
			params: KeyVal,
			...args: unknown[]
		) {
			for (const key of keys) {
				if (!params || !params[key]) {
					throw new KeyError(`Missing key "${key}"`);
				}
			}

			const bound = original.bind(this);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const result = bound(res, params, ...args);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			return result;
		};
	};
}

export function auth(
	target: unknown,
	propertyKey: string,
	descriptor: PropertyDescriptor
): void {
	requireParams('auth')(target, propertyKey, descriptor);

	// eslint-disable-next-line @typescript-eslint/ban-types
	const original = descriptor.value as Function;
	descriptor.value = function (
		res: express.Response,
		params: KeyVal,
		...args: unknown[]
	) {
		if (!Auth.ClientSecret.authenticate(params.auth, params.id || '0')) {
			throw new AuthError('Invalid auth key');
		}

		const bound = original.bind(this);
		const result = bound(res, params, ...args);
		return result;
	};
}

export function authCookie(
	_target: unknown,
	_propertyKey: string,
	descriptor: PropertyDescriptor
): void {
	const original = descriptor.value as Function;
	descriptor.value = function (
		res: express.Response,
		req:
			| express.Request
			| {
					cookies: {
						[key: string]: string;
					};
			  },
		...args: unknown[]
	) {
		if (!Auth.Cookie.checkCookie(req)) {
			throw new AuthError('Invalid or missing auth cookie');
		}

		const bound = original.bind(this);
		const result = bound(res, req, ...args);
		return result;
	};
}

export function authAll(
	_target: unknown,
	_propertyKey: string,
	descriptor: PropertyDescriptor
): void {
	const original = descriptor.value;
	descriptor.value = function (
		res: express.Response,
		params: KeyVal & {
			cookies: {
				[key: string]: string;
			};
		},
		...args: unknown[]
	) {
		if (Auth.Cookie.checkCookie(params)) {
			return original.bind(this)(res, params, ...args);
		} else if (params?.cookies['key']) {
			throw new AuthError('Invalid auth cookie');
		}

		if (!params || !params['auth']) {
			throw new KeyError('Missing key "auth"');
		}
		if (Auth.ClientSecret.authenticate(params.auth, params.id || '0')) {
			return original.bind(this)(res, params, ...args);
		} else {
			throw new AuthError('Invalid auth key');
		}
	};
}

export function errorHandle(
	_target: unknown,
	_propertyKey: string,
	descriptor: PropertyDescriptor
): void {
	const original = descriptor.value;
	descriptor.value = async function (
		res: express.Response,
		...args: unknown[]
	) {
		try {
			return await original.bind(this)(res, ...args);
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
	};
}

export function upgradeToHTTPS(
	_target: unknown,
	_propertyKey: string,
	descriptor: PropertyDescriptor
): void {
	const original = descriptor.value;
	// eslint-disable-next-line @typescript-eslint/require-await
	descriptor.value = async function (
		res: express.Response,
		req: express.Request,
		...args: unknown[]
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
			res.redirect(`https://${req.headers.host!}${req.url}`);
			return;
		}

		return original.bind(this)(res, req, ...args);
	};
}
