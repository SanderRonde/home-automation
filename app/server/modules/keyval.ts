import { errorHandle, requireParams, auth } from "../lib/decorators";
import { Database } from "../lib/db";
import * as express from "express";

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

class APIHandler {
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
}

export function initKeyValRoutes(app: express.Express, db: Database) {
	app.get('/:auth/:key', (req, res, _next) => {
		APIHandler.get(res, req.params, db);
	});
	app.get('/long/:maxtime/:auth/:key/:expected', (req, res, _next) => {
		APIHandler.getLongPoll(res, req.params, db);
	});
	app.all('/:auth/:key/:value', (req, res, _next) => {
		APIHandler.set(res, req.params, db);
	});
}