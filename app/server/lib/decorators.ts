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
				if (!params || !params[key]) {
					throw new KeyError(`Missing key ${key}`);
				}
			}

			return original.bind(this)(res, params, ...args);
		}
    };
}

export function auth(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
	requireParams('auth')(target, propertyKey, descriptor);

	const original = descriptor.value;
	descriptor.value = async function (res: express.Response, params: KeyVal, ...args: any[]) {
		if (!await Auth.ClientSecret.authenticate(params.auth, params.id || '0')) {
			throw new AuthError('Invalid auth key');
		}

		return original.bind(this)(res, params, ...args);;
	}
}

export function authCookie(_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
	const original = descriptor.value;
	descriptor.value = async function (res: express.Response, req: express.Request, ...args: any[]) {
		if (!await Auth.Cookie.checkCookie(req)) {
			throw new AuthError('Invalid or missing auth cookie');
		}

		return original.bind(this)(res, req, ...args);
	}
}

export function errorHandle(_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
	const original = descriptor.value;
	descriptor.value = async function (res: express.Response, ...args: any[]) {
		try {
			return await original.bind(this)(res, ...args);
		} catch(e) {
			if (e instanceof KeyError) {
				res.status(400).write(e.message);
			} else if (e instanceof AuthError) {
				res.status(403).write(e.message);
			} else {
				const msg = attachMessage(res, chalk.red(chalk.bgBlack(e.message)));
				for (const line of e.stack.split('\n')) {
					attachMessage(msg, line);
				}
				res.status(500).write('Internal server error');
			}
			res.end();
		}
	}
}