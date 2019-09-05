import { errorHandle, authCookie, requireParams, auth } from '../lib/decorators';
import { attachMessage, logFixture, getTime } from '../lib/logger';
import { AppWrapper } from "../lib/routes";
import { ScriptExternal } from './script';
import { KeyvalExternal } from './keyval';
import hooks from '../config/home-hooks';
import config from '../config/home-ips';
import { ResponseLike } from "./multi";
import { Database } from "../lib/db";
import { RGBExternal } from './rgb';
import express = require("express");
import { Auth } from '../lib/auth';
import * as ping from 'ping';
import chalk from 'chalk';

const AWAY_PING_INTERVAL = 7;
const HOME_PING_INTERVAL = 60;
const CHANGE_PING_INTERVAL = 1;
const CHANGE_MIN_CONSECUTIVE_PINGS = 10;

const enum HOME_STATE {
	HOME = 'home',
	AWAY = 'away'
};

function wait(time: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, time);
	});
}

class Pinger {
	private _state: HOME_STATE|null = null;

	constructor(private _config: {
		name: string;
		ips: string[];
	}, private _db: Database, private _onChange: (newState: HOME_STATE) => void) { 
		this._init();
	}

	private async _ping(ip: string) {
		const { alive } = await ping.promise.probe(ip, {
			timeout: 2000
		})
		return {
			state: alive ? 
				HOME_STATE.HOME : HOME_STATE.AWAY
		}
	}

	private async _pingAll(): Promise<{
		ip: string;
		state: HOME_STATE.HOME;
	}|{
		ip?: string;
		state: HOME_STATE.AWAY;
	}> {
		const pings = await Promise.all(this._config.ips.map((ip) => {
			return ping.promise.probe(ip, {
				timeout: 2000
			});
		}))
		for (const ping of pings) {
			if (ping.alive) {
				return {
					ip: ping.host,
					state: HOME_STATE.HOME
				}
			}
		}
		return {
			state: HOME_STATE.AWAY
		}
	}

	private async _fastPing(ip: string) {
		const pings: Promise<{
			ip?: string;
			state: HOME_STATE;
		}>[] = [];

		for (let i = 0; i < CHANGE_MIN_CONSECUTIVE_PINGS; i++) {
			pings.push(this._ping(ip));
			await wait(CHANGE_PING_INTERVAL * 1000);
		}

		const results = await Promise.all(pings);
		return results.some((v => v.state === HOME_STATE.HOME)) ?
			HOME_STATE.HOME : HOME_STATE.AWAY;
	}

	private async _stateChange(newState: {
		ip: string;
		state: HOME_STATE.HOME;
	} | {
		ip?: string | undefined;
		state: HOME_STATE.AWAY;
	}) {
		if (newState.state === HOME_STATE.HOME) {
			return this._fastPing(newState.ip);
		} else {
			return (await Promise.all(this._config.ips.map((ip) => {
				return this._fastPing(ip);
			}))).some((v => v === HOME_STATE.HOME)) ?
				HOME_STATE.HOME : HOME_STATE.AWAY;
		}
	}

	private async _pingLoop() {
		while (true) {
			const newState = await this._pingAll();
			if (newState.state !== this._state) {
				let finalState: HOME_STATE = newState.state;
				if (newState.state !== HOME_STATE.HOME) {
					finalState = await this._stateChange(newState);	
				} else {
					// A ping definitely landed, device is home
				}
				if (finalState !== this._state) {
					this._onChange(finalState);
				}
				this._state = finalState;
				await wait(CHANGE_PING_INTERVAL);
			} else {
				await wait((this._state! === HOME_STATE.HOME ?
					HOME_PING_INTERVAL : AWAY_PING_INTERVAL) * 1000);
			}
		}
	}

	private async _init() {
		this._state = await this._db.get(this._config.name,
			HOME_STATE.AWAY);
		this._pingLoop();
	}

	get state() {
		return this._state!;
	}
}

export class Detector {
	private _db: Database;
	private static _listeners: {
		name: string|null;
		callback: (newState: HOME_STATE, name: string) => void;
	}[] = [];
	private _pingers: Map<string, Pinger> = new Map();

	constructor({ db }: {
		db: Database
	}) {
		this._db = db;
		this._initPingers();
	}

	private _onChange(changeName: string, newState: HOME_STATE) {
		Detector._listeners.forEach(({ name, callback }) => {
			if (name === null || changeName === name) {
				callback(newState, changeName);
			}
		});
	}

	private _initPingers() {
		for (const name in config) {
			this._pingers.set(name, new Pinger({
				name,
				ips: config[name]
			}, this._db, (newState) => {
				this._onChange(name, newState);
			}));
		}
	}

	getAll() {
		const obj: {
			[key: string]: HOME_STATE;
		} = {};
		this._pingers.forEach((pinger, key) => {
			obj[key] = pinger.state;
		});
		return obj;
	}

	get(name: string) {
		const pinger = this._pingers.get(name);
		if (!pinger) {
			return '?';
		}
		return pinger.state;
	}

	static addListener(name: string|null, callback: (newState: HOME_STATE, name: string) => void) {
		this._listeners.push({ name, callback });
	}
}

class APIHandler {
	private _detector: Detector;

	constructor({
		detector
	}: {
		detector: Detector;
	}) {
		this._detector = detector;
	}

	@errorHandle
	@requireParams('name')
	@auth
	public async get(res: ResponseLike, { name }: {
		name: string
	}) {
		const result = this._detector.get(name);
		attachMessage(res, `Name: ${name}, val: ${result}`);
		res.write(result);
		res.end();
	}

	@errorHandle
	@auth
	public async getAll(res: ResponseLike, _params: {
		auth: string;
	}) {
		const result = JSON.stringify(this._detector.getAll());
		attachMessage(res, `JSON: ${result}`);
		res.write(result);
		res.end();
	}
}

async function homeDetectorHTML(json: string) {
	return `<html style="background-color: rgb(40, 40, 40);">
		<head>
			<link rel="icon" href="/home-detector/favicon.ico" type="image/x-icon" />
			<meta name="viewport" content="width=device-width, initial-scale=1">
			<title>Who is home</title>
		</head>
		<body style="margin: 0">
			<home-detector-display json='${json}' key="${await Auth.Secret.getKey()}"></home-detector-display>
			<script type="module" src="/home-detector/home-detector.bundle.js"></script>
		</body>
	</html>`;
}

export class WebpageHandler {
	private _detector: Detector;

	constructor({ detector }: { detector: Detector }) {
		this._detector = detector;
	}
	
	@errorHandle
	@authCookie
	public async index(res: ResponseLike, _req: express.Request) {
		res.status(200);
		res.contentType('.html');
		res.write(await homeDetectorHTML(JSON.stringify(this._detector.getAll())));
		res.end();
	}
}

export interface ModuleHookables {
	rgb: typeof RGBExternal;
	keyval: typeof KeyvalExternal;
	script: typeof ScriptExternal;
}

function proxyHookable<T extends {
	logObj: any;
}>(logObj: any, base: T) {
	return new Proxy(base, {
		get(target, property) {
			const value = target[property as keyof typeof target];
			if (typeof value !== 'function') {
				return value;
			}

			return new Proxy(target, {
				get(_, prop, receiver) {
					if (prop === 'logObj') return logObj;
					return Reflect.get(target, prop, receiver);
				}
			});
		}
	})
}

function createHookables(lobObj: any): ModuleHookables {
	return {
		rgb: proxyHookable(lobObj, RGBExternal),
		keyval: proxyHookable(lobObj, KeyvalExternal),
		script: proxyHookable(lobObj, ScriptExternal),
	}
}

async function handleHooks(newState: HOME_STATE, name: string) {
	if (!(name in hooks)) {
		return;
	}

	const nameHooks = hooks[name];
	const changeHooks = (() => {
		if (newState === HOME_STATE.HOME) {
			return nameHooks.home;
		} else {
			return nameHooks.away;
		}
	})();
	if (!changeHooks) return;

	const logObj = {};
	for (let i = 0; i < changeHooks.length; i++) {
		const { name, fn } = changeHooks[i];
		await fn(createHookables(attachMessage(logObj, 'Hook', chalk.bold(i + ''), 
		':', chalk.bold(name))));
	}
	logFixture(logObj, chalk.cyan('[hook]'), 
		'State for', chalk.bold(name), 'changed to', chalk.bold(newState));
}

export function initHomeDetector(app: AppWrapper, db: Database) {
	Detector.addListener(null, (newState, name) => {
		console.log(getTime(), chalk.cyan(`[device:${name}]`, newState === HOME_STATE.HOME ?
			chalk.bold(chalk.blue('now home')) : chalk.blue('just left')));
	});
	Detector.addListener(null, async (newState, name) => {
		await handleHooks(newState, name);
	});

	const detector = new Detector({ db });
	const apiHandler = new APIHandler({ detector });
	const webpageHandler = new WebpageHandler({ detector });

	app.post('/home-detector/all', async (req, res) => {
		await apiHandler.getAll(res, {...req.params, ...req.body});
	});
	app.post('/home-detector/:name', async (req, res) => {
		await apiHandler.get(res, {...req.params, ...req.body});
	});

	app.all([
		'/home-detector', 
		'/whoishome',
		'/whoshome'
	], async (req, res) => {
		webpageHandler.index(res, req);
	});
}