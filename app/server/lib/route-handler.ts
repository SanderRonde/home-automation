import { KeyError, AuthError } from './errors';
import * as express from 'express';
import { Database } from './db';
import { authenticate } from './auth';

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

function auth(_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
	const original = descriptor.value;
	descriptor.value = (res: express.Response, params: KeyVal, ...args: any[]) => {
		if (!authenticate(params.auth)) {
			throw new AuthError('Invalid auth key');
		}

		original(res, params, ...args);;
	}
}

function errorHandle(_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
	const original = descriptor.value;
	descriptor.value = (res: express.Response, ...args: any[]) => {
		RouteHandler.errorHandler(res, () => {
			original(res, ...args);;
		});
	}
}

class GetSetListener {
	private static _listeners: Map<number, {
		key: string;
		listener: () => void;
	}> = new Map();
	private static _lastIndex: number = 0;

	public static addListener(key: string, listener: () => void) {
		const index = this._lastIndex++;
		this._listeners.set(index, {
			key, listener
		});
		return index;
	}

	public static removeListener(index: number) {
		this._listeners.delete(index);
	}

	public static update(key: string) {
		const updatedKeyParts = key.split('.');

		for (const [index, { key: listenerKey, listener }] of this._listeners) {
			const listenerParts = listenerKey.split('.');
			for (let i = 0; i < Math.min(updatedKeyParts.length, listenerParts.length); i++) {
				if (updatedKeyParts[i] !== listenerParts[i]) continue;
			}

			listener();
			this._listeners.delete(index);
		}
	}
}

export class RouteHandler {
	@errorHandle
	@requireParams('auth', 'key')
	@auth
	public static get(res: express.Response, params: {
		key: string;
		auth: string;
	}, db: Database) {
		const value = db.get(params.key);
		res.status(200).write(value === undefined ?
			'' : value);
		res.end();
	}

	@errorHandle
	@requireParams('auth', 'key', 'maxtime', 'expected')
	@auth
	public static getLongPoll(res: express.Response, params: {
		key: string;
		expected: string;
		auth: string;
		maxtime: string;
	}, db: Database) {
		const value = db.get(params.key);
		if (value !== params.expected) {
			res.status(200).write(value === undefined ? '' : value);
			res.end();
			return;
		}

		// Wait for changes to this key
		let triggered: boolean = false;
		const id = GetSetListener.addListener(params.key, () => {
			triggered = true;
			const value = db.get(params.key);
			res.status(200).write(value === undefined ? '' : value);
			res.end();
		});
		setTimeout(() => {
			if (!triggered) {
				GetSetListener.removeListener(id);
				const value = db.get(params.key);
				res.status(200).write(value === undefined ? '' : value);
				res.end();
			}
		}, parseInt(params.maxtime, 10) * 1000);
	}

	@errorHandle
	@requireParams('auth', 'key', 'value')
	@auth
	public static async set(res: express.Response, params: {
		key: string;
		value: string;
		auth: string;
	}, db: Database) {
		await db.setVal(params.key, params.value);
		GetSetListener.update(params.key);
		res.status(200).write(params.value);
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