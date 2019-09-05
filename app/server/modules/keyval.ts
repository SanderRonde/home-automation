import { attachMessage, getLogLevel, ResDummy } from "../lib/logger";
import { errorHandle, requireParams, auth, authCookie } from "../lib/decorators";
import * as ReadLine from '@serialport/parser-readline';
import { WSSimulator, WSInstance } from "../lib/ws";
import { AppWrapper } from "../lib/routes";
import * as SerialPort from 'serialport';
import { ResponseLike } from "./multi";
import { Database } from "../lib/db";
import * as express from "express";
import { Auth } from "../lib/auth";
import chalk from "chalk";

function str(value: any|undefined) {
	return JSON.stringify(value || null);
}

namespace GetSetListener {
	const _listeners: Map<number, {
		key: string;
		listener: () => void;
		once: boolean;
	}> = new Map();
	let _lastIndex: number = 0;

	export function addListener(key: string, listener: () => void, once: boolean = false) {
		const index = _lastIndex++;
		_listeners.set(index, {
			key, listener, once
		});
		return index;
	}

	export function removeListener(index: number) {
		_listeners.delete(index);
	}

	export function update(key: string) {
		let updated: number = 0;
		const updatedKeyParts = key.split('.');

		for (const [index, { key: listenerKey, listener, once }] of _listeners) {
			const listenerParts = listenerKey.split('.');
			for (let i = 0; i < Math.min(updatedKeyParts.length, listenerParts.length); i++) {
				if (updatedKeyParts[i] !== listenerParts[i]) continue;
			}

			listener();
			updated++;
			if (once) {
				_listeners.delete(index);
			}
		}
		return updated;
	}
}

type ExternalRequest = ({
	type: 'get';
	resolver: (value: any) => void;
}|{
	type: 'set';
	value: string;
	resolver: () => void;
}) & {
	key: string;
	logObj: any;
};

export class KeyvalExternal {
	private static _requests: ExternalRequest[] = [];
	private static _db: Database|null = null;
	private static _apiHandler: APIHandler|null = null;

	static async init({ db, apiHandler }: { 
		db: Database, 
		apiHandler: APIHandler 
	}) {
		this._db = db;
		this._apiHandler = apiHandler;
		for (const req of this._requests) {
			await this._handleRequest(req);
		}
	}

	private static async _handleRequest(request: ExternalRequest) {
		const { logObj } = request;
		const resDummy = new ResDummy();
		if (request.type === 'get') {
			const { key, resolver } = request;
			const value = await this._apiHandler!.get(resDummy, {
				key,
				auth: await Auth.Secret.getKey()
			})
			resDummy.transferTo(logObj);
			resolver(value);
		} else {
			const { key, value, resolver } = request;
			await this._apiHandler!.set(resDummy, {
				key,
				value,
				auth: await Auth.Secret.getKey()
			})
			resDummy.transferTo(logObj);
			resolver();
		}
	}

	static async set(logObj: any, key: string, value: string) {
		return new Promise((resolve) => {
			const req: ExternalRequest = {
				type: 'set',
				key,
				value,
				logObj,
				resolver: resolve
			};
			if (this._db) {
				this._handleRequest(req);
			} else {
				this._requests.push(req)
			}
		});
	}

	static async get<V>(logObj: any, key: string) {
		return new Promise<V>((resolve) => {
			const req: ExternalRequest = {
				type: 'get',
				key,
				logObj,
				resolver: resolve
			};
			if (this._db) {
				this._handleRequest(req);
			} else {
				this._requests.push(req)
			}
		});
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
	public get(res: ResponseLike, { key }: {
		key: string;
		auth?: string;
	}) {
		const value = this._db.get(key, '0');
		attachMessage(res, `Key: "${key}", val: "${str(value)}"`);
		res.status(200).write(value === undefined ?
			'' : value);
		res.end();
		return value;
	}

	@errorHandle
	@requireParams('key', 'maxtime', 'expected')
	@auth
	public getLongPoll(res: ResponseLike, { key, expected, maxtime }: {
		key: string;
		expected: string;
		auth: string;
		maxtime: string;
	}) {
		const value = this._db.get(key, '0');
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
			const value = this._db.get(key, '0');
			const msg = attachMessage(res, `Key: "${key}", val: "${str(value)}"`);
			attachMessage(msg, `Set to "${str(value)}". Expected "${expected}"`);
			res.status(200).write(value === undefined ? '' : value);
			res.end();
		}, true);
		setTimeout(() => {
			if (!triggered) {
				GetSetListener.removeListener(id);
				const value = this._db.get(key, '0');
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
	public async set(res: ResponseLike, { key, value }: {
		key: string;
		value: string;
		auth?: string;
	}) {
		const original = this._db.get(key);
		await this._db.setVal(key, value);
		const msg = attachMessage(res, `Key: "${key}", val: "${str(value)}"`);
		const nextMessage = attachMessage(msg, `"${str(original)}" -> "${str(value)}"`)
		const updated = GetSetListener.update(key);
		attachMessage(nextMessage, `Updated ${updated} listeners`);
		res.status(200).write(value);
		res.end();
	}

	@errorHandle
	@auth
	public async all(res: ResponseLike, { force = false }: {
		force?: boolean;
	}) {
		const data = await this._db.json(force);
		const msg = attachMessage(res, data);
		attachMessage(msg, `Force? ${force ? 'true' : 'false'}`);
		res.status(200).write(data);
		res.end();
	}
}

async function keyvalHTML(json: string) {
	return `<html style="background-color: rgb(70,70,70);">
		<head>
			<link rel="icon" href="/keyval/favicon.ico" type="image/x-icon" />
			<link rel="manifest" href="/keyval/static/manifest.json">
			<meta name="viewport" content="width=device-width, initial-scale=1">
			<title>KeyVal Switch</title>
		</head>
		<body style="margin: 0">
			<json-switches json='${json}' key="${await Auth.Secret.getKey()}"></json-switches>
			<script type="module" src="/keyval/keyval.bundle.js"></script>
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
	public async index(res: ResponseLike, _req: express.Request) {
		res.status(200);
		res.contentType('.html');
		res.write(await keyvalHTML(await this._db.json(true)));
		res.end();
	}
}

class ScreenHandler {
	private _port: SerialPort = new SerialPort('/dev/ttyUSB0', {
		baudRate: 9600
	});
	// @ts-ignore
	private _parser = new ReadLine()
	private _db: Database;

	constructor({ db }: { db: Database }) {
		this._db = db;

		//@ts-ignore
		this._port.pipe(this._parser);
		this._parser.on('data', async (line: string) => {
			if (line.startsWith('#')) {
				if (getLogLevel() > 1) {
					console.log(chalk.gray('[/dev/ttyUSB0]'),
						line.slice(2));
				}
				return;
			}
			const [ key, value ] = line.split(' ');
			console.log(chalk.cyan('[/dev/ttyUSB0]'),
				chalk.white(line));
			await this._db.setVal(`room.${key}`, value.trim());
			GetSetListener.update(key)
		});
		GetSetListener.addListener('room.lights.ceiling', () => {
			const value = this._db.get('room.lights.ceiling', '0');
			this._port.write(value);
		});
	}
}

type WSMessages = {
	send: "authid"|"authfail"|"authsuccess"|"valChange";
	receive: "auth"|"listen";
}

export async function initKeyValRoutes(app: AppWrapper, websocket: WSSimulator, db: Database) {
	const apiHandler = new APIHandler({ db });
	const webpageHandler = new WebpageHandler({ db });
	// @ts-ignore
	const screenHandler = new ScreenHandler({ db });
	await KeyvalExternal.init({ db, apiHandler });

	app.post('/keyval/all', async (req, res) => {
		await apiHandler.all(res, {...req.params, ...req.body});
	});
	app.post('/keyval/long/:key', async (req, res) => {
		await apiHandler.getLongPoll(res, {...req.params, ...req.body});
	});
	app.get('/keyval/long/:maxtime/:auth/:key/:expected', async (req, res) => {
		await apiHandler.getLongPoll(res, {...req.params, ...req.body});
	});
	app.post('/keyval/:key', async (req, res) => {
		await apiHandler.get(res, {...req.params, ...req.body});
	});
	app.post('/keyval/:key/:value', async (req, res) => {
		await apiHandler.set(res, {...req.params, ...req.body});
	});

	websocket.all('/keyval/websocket', async (instance: WSInstance<WSMessages>) => {
		instance.listen('listen', (key) => {
			let lastVal: string|undefined = undefined;
			const onChange = () => {
				const val = db.get(key, '0');
				if (val !== lastVal) {
					lastVal = val;
					instance.send('valChange', val);
				}
			}
			const listener = GetSetListener.addListener(key, onChange);
			onChange();

			instance.onClose = () => {
				GetSetListener.removeListener(listener);
			}
		});
	});

	app.all('/keyval', async (req, res) => {
		await webpageHandler.index(res, req);
	});
}