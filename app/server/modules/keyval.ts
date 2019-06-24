import { errorHandle, requireParams, auth, authCookie } from "../lib/decorators";
import { attachMessage } from "../lib/logger";
import { Database } from "../lib/db";
import * as express from "express";

function str(value: any|undefined) {
	return JSON.stringify(value || null);
}

namespace GetSetListener {
	const _listeners: Map<number, {
		key: string;
		listener: () => void;
	}> = new Map();
	let _lastIndex: number = 0;

	export function addListener(key: string, listener: () => void) {
		const index = _lastIndex++;
		_listeners.set(index, {
			key, listener
		});
		return index;
	}

	export function removeListener(index: number) {
		_listeners.delete(index);
	}

	export function update(key: string) {
		let updated: number = 0;
		const updatedKeyParts = key.split('.');

		for (const [index, { key: listenerKey, listener }] of _listeners) {
			const listenerParts = listenerKey.split('.');
			for (let i = 0; i < Math.min(updatedKeyParts.length, listenerParts.length); i++) {
				if (updatedKeyParts[i] !== listenerParts[i]) continue;
			}

			listener();
			updated++;
			_listeners.delete(index);
		}
		return updated;
	}
}

class APIHandler {
	private _db: Database;

	constructor({
		db
	}: {
		db: Database
	}) {
		this._db = db;
	}

	@errorHandle
	@requireParams('key')
	@auth
	public get(res: express.Response, { key }: {
		key: string;
		auth: string;
	}) {
		const value = this._db.get(key);
		attachMessage(res, `Key: "${key}", val: "${str(value)}"`);
		res.status(200).write(value === undefined ?
			'' : value);
		res.end();
	}

	@errorHandle
	@requireParams('key', 'maxtime', 'expected')
	@auth
	public getLongPoll(res: express.Response, { key, expected, maxtime }: {
		key: string;
		expected: string;
		auth: string;
		maxtime: string;
	}) {
		const value = this._db.get(key);
		if (value !== expected) {
			const msg = attachMessage(res, `Key: "${key}", val: "${str(value)}"`);
			attachMessage(msg, `(current) "${str(value)}" != (expected) "${expected}"`);
			res.status(200).write(value === undefined ? '' : value);
			res.end();
			return;
		}

		// Wait for changes to this key
		let triggered: boolean = false;
		const id = GetSetListener.addListener(key, () => {
			triggered = true;
			const value = this._db.get(key);
			const msg = attachMessage(res, `Key: "${key}", val: "${str(value)}"`);
			attachMessage(msg, `Set to "${str(value)}". Expected "${expected}"`);
			res.status(200).write(value === undefined ? '' : value);
			res.end();
		});
		setTimeout(() => {
			if (!triggered) {
				GetSetListener.removeListener(id);
				const value = this._db.get(key);
				const msg = attachMessage(res, `Key: "${key}", val: "${str(value)}"`);
				attachMessage(msg, `Timeout. Expected "${expected}"`);
				res.status(200).write(value === undefined ? '' : value);
				res.end();
			}
		}, parseInt(maxtime, 10) * 1000);
	}

	@errorHandle
	@requireParams('key', 'value')
	@auth
	public async set(res: express.Response, { key, value }: {
		key: string;
		value: string;
		auth: string;
	}) {
		const original = await this._db.setVal(key, value);
		const msg = attachMessage(res, `Key: "${key}", val: "${str(value)}"`);
		const nextMessage = attachMessage(msg, `"${str(value)}" -> "${str(original)}"`)
		const updated = GetSetListener.update(key);
		attachMessage(nextMessage, `Updated ${updated} listeners`);
		res.status(200).write(value);
		res.end();
	}

	@errorHandle
	@auth
	public async all(res: express.Response, { force = false }: {
		force?: boolean;
	}) {
		const data = await this._db.json(force);
		const msg = attachMessage(res, data);
		attachMessage(msg, `Force? ${force ? 'true' : 'false'}`);
		res.status(200).write(data);
		res.end();
	}
}

function keyvalHTML(json: string) {
	return `<html>
		<head>
			<title>KeyVal</title>
		</head>
		<body>
			<json-switches json='${json}'></json-switches>
			<script type="module" src="./keyval.js"></script>
		</body>
	</html>`;
}

export class WebpageHandler {
	private _db: Database

	constructor({ db }: { db: Database }) {
		this._db = db;
	}
	
	@errorHandle
	@authCookie
	public async index(res: express.Response, _req: express.Request) {
		res.status(200);
		res.contentType('.html');
		res.write(keyvalHTML(await this._db.json(true)));
		res.end();
	}
}

export function initKeyValRoutes(app: express.Express, db: Database) {
	const apiHandler = new APIHandler({ db });
	const webpageHandler = new WebpageHandler({ db });

	app.post('/keyval/all', (req, res) => {
		apiHandler.all(res, {...req.params, ...req.body});
	});
	app.post('/keyval/long/:key', (req, res) => {
		apiHandler.getLongPoll(res, {...req.params, ...req.body});
	});
	app.post('/keyval/:key', (req, res) => {
		apiHandler.get(res, {...req.params, ...req.body});
	});
	app.post('/keyval/:key/:value', (req, res) => {
		apiHandler.set(res, {...req.params, ...req.body});
	});

	app.all('/keyval', (req, res, _next) => {
		webpageHandler.index(res, req);
	});
}