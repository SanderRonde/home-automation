import { KeyError, AuthError } from './errors';
import { authenticate } from './auth';
import * as express from 'express';

interface KeyVal {
	[key: string]: string;
}

export function requireParams(...keys: string[]) {
    return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
		const original = descriptor.value;
        descriptor.value = (res: express.Response, params: KeyVal, ...args: any[]) => {
			for (const key of keys) {
				if (!params[key]) {
					throw new KeyError(`Missing key ${key}`);
				}
			}

			original(res, params, ...args);
		}
    };
}

export function auth(_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
	const original = descriptor.value;
	descriptor.value = (res: express.Response, params: KeyVal, ...args: any[]) => {
		if (!authenticate(params.auth)) {
			throw new AuthError('Invalid auth key');
		}

		original(res, params, ...args);;
	}
}

export function errorHandle(_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
	const original = descriptor.value;
	descriptor.value = (res: express.Response, ...args: any[]) => {
		try {
			original(res, ...args);
		} catch(e) {
			if (e instanceof KeyError) {
				res.status(400).write(e.message)
			} else if (e instanceof AuthError) {
				res.status(403).write(e.message);
			} else {
				res.status(400).write('Internal server error');
			}
			res.end();
		}
	}
}