import { KeyError, AuthError } from './errors';
import * as express from 'express';
import { Database } from './db';

interface KeyVal {
	[key: string]: string;
}

function requireParams(...keys: string[]) {
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

function errorHandle(_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
	const original = descriptor.value;
	descriptor.value = (res: express.Response, ...args: any[]) => {
		RouteHandler.errorHandler(res, () => {
			original(res, ...args);;
		});
	}
}

export class RouteHandler {
	@errorHandle
	@requireParams('auth', 'key')
	public static get(res: express.Response, params: KeyVal, db: Database) {
		const value = db.get(params.key);
		res.status(200).write(value === undefined ?
			'' : value);
		res.end();
	}

	@errorHandle
	@requireParams('auth', 'key', 'value')
	public static async set(res: express.Response, params: KeyVal, db: Database) {
		await db.setVal(params.key, params.value);
		res.status(200);
		res.end();
	}

	public static errorHandler(res: express.Response, fn: () => void) {
		try {
			fn();
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