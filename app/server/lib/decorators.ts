import { KeyError, AuthError } from './errors';
import { attachMessage } from './logger';
import * as express from 'express';
import { Auth } from './auth';
import chalk from 'chalk';

interface KeyVal {
	[key: string]: string;
}

export function requireParams(...keys: string[]) {
    return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
		const original = descriptor.value;
        descriptor.value = function (res: express.Response, params: KeyVal, ...args: any[]) {
			for (const key of keys) {
				if (!params[key]) {
					throw new KeyError(`Missing key ${key}`);
				}
			}

			original.bind(this)(res, params, ...args);
		}
    };
}

export function auth(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
	requireParams('auth', 'id')(target, propertyKey, descriptor);

	const original = descriptor.value;
	descriptor.value = function (res: express.Response, params: KeyVal, ...args: any[]) {
		if (!Auth.ClientSecret.authenticate(params.auth, params.id)) {
			throw new AuthError('Invalid auth key');
		}

		original.bind(this)(res, params, ...args);;
	}
}

export function authCookie(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
	requireParams('auth', 'id')(target, propertyKey, descriptor);

	const original = descriptor.value;
	descriptor.value = function (req: express.Request, ...args: any[]) {
		if (!Auth.Cookie.checkCookie(req)) {
			throw new AuthError('Invalid or missing auth cookie');
		}

		original.bind(this)(req, ...args);
	}
}

export function errorHandle(_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
	const original = descriptor.value;
	descriptor.value = function (res: express.Response, ...args: any[]) {
		try {
			original.bind(this)(res, ...args);
		} catch(e) {
			if (e instanceof KeyError) {
				res.status(400).write(e.message)
			} else if (e instanceof AuthError) {
				res.status(403).write(e.message);
			} else {
				const msg = attachMessage(res, chalk.red(chalk.bgBlack(e.message)));
				console.log(e.stack.split('\n'));
				for (const line of e.stack.split('\n')) {
					attachMessage(msg, line);
				}
				res.status(500).write('Internal server error');
			}
			res.end();
		}
	}
}