import { errorHandle, authCookie, requireParams, auth } from '../lib/decorators';
import { attachMessage, logFixture, getTime, log } from '../lib/logger';
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

const AWAY_PING_INTERVAL = 5;
const HOME_PING_INTERVAL = 60;
const CHANGE_PING_INTERVAL = 1;
const AWAY_MIN_CONSECUTIVE_PINGS = 20;

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

		for (let i = 0; i < AWAY_MIN_CONSECUTIVE_PINGS; i++) {
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
				if (finalState !== this._state && this._state !== null) {
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
	private _basePingers: Map<string, Pinger> = new Map();
	private _extendedPingers: Map<string, Pinger> = new Map();

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
		for (const { key, data, extended } of [
			...(Object.keys(config.base) || []).map(n => ({ key: n, data: config.base[n], extended: false })),
			...(Object.keys(config.extended) || []).map(n => ({ key: n, data: config.extended[n], extended: true }))
		]) {
			this._extendedPingers.set(key, new Pinger({
				name: key,
				ips: data
			}, this._db, (newState) => {
				this._onChange(key, newState);
			}));
			if (!extended) {
				this._basePingers.set(key, this._extendedPingers.get(key)!);
			}
		}
	}

	getAll(extended: boolean = false) {
		const obj: {
			[key: string]: HOME_STATE;
		} = {};
		if (extended) {
			this._extendedPingers.forEach((pinger, key) => {
				obj[key] = pinger.state;
			});
		} else {
			this._basePingers.forEach((pinger, key) => {
				obj[key] = pinger.state;
			});
		}
		return obj;
	}

	get(name: string) {
		const pinger = this._extendedPingers.get(name);
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
	}, extended: boolean = false) {
		const result = JSON.stringify(this._detector.getAll(extended));
		attachMessage(res, `JSON: ${result}`);
		res.write(result);
		res.end();
	}
}

async function homeDetectorHTML(json: string, randomNum: number) {
	return `<html style="background-color: rgb(40, 40, 40);">
		<head>
			<link rel="icon" href="/home-detector/favicon.ico" type="image/x-icon" />
			<meta name="viewport" content="width=device-width, initial-scale=1">
			<title>Who is home</title>
		</head>
		<body style="margin: 0">
			<home-detector-display json='${json}' key="${await Auth.Secret.getKey()}"></home-detector-display>
			<script type="module" src="/home-detector/home-detector.bundle.js?n=${randomNum}"></script>
		</body>
	</html>`;
}

export class WebpageHandler {
	private _detector: Detector;
	private _randomNum: number;

	constructor({ detector, randomNum }: { randomNum: number; detector: Detector }) {
		this._detector = detector;
		this._randomNum = randomNum;
	}
	
	@errorHandle
	@authCookie
	public async index(res: ResponseLike, _req: express.Request, extended: boolean = false) {
		res.status(200);
		res.contentType('.html');
		res.write(await homeDetectorHTML(
			JSON.stringify(this._detector.getAll(extended)), this._randomNum));
		res.end();
	}
}

export interface ModuleHookables {
	rgb: RGBExternal;
	keyval: KeyvalExternal;
	script: ScriptExternal;
}

export interface HomeHooks {
	[key: string]: {
		home?: {
			[name: string]: ((hookables: ModuleHookables) => void);
		};
		away?: {
			[name: string]: ((hookables: ModuleHookables) => void);
		}
	}
}

function createHookables(logObj: any): ModuleHookables {
	return {
		rgb: new RGBExternal(logObj),
		keyval: new KeyvalExternal(logObj),
		script: new ScriptExternal(logObj),
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

	let index = 0;
	const logObj = {};
	for (const name in changeHooks) {
		const fn = changeHooks[name];
		await fn(createHookables(attachMessage(logObj, 'Hook', chalk.bold(index++ + ''), 
		':', chalk.bold(name))));
	}
	logFixture(logObj, chalk.cyan('[hook]'), 
		'State for', chalk.bold(name), 'changed to', chalk.bold(newState));
}

export function initHomeDetector({ 
	app, db, randomNum 
}: { 
	app: AppWrapper; 
	db: Database; 
	randomNum: number; 
}) {
	Detector.addListener(null, (newState, name) => {
		log(getTime(), chalk.cyan(`[device:${name}]`, newState === HOME_STATE.HOME ?
			chalk.bold(chalk.blue('now home')) : chalk.blue('just left')));
	});
	Detector.addListener(null, async (newState, name) => {
		await handleHooks(newState, name);
	});

	const detector = new Detector({ db });
	const apiHandler = new APIHandler({ detector });
	const webpageHandler = new WebpageHandler({ randomNum, detector });

	app.post('/home-detector/all', async (req, res) => {
		await apiHandler.getAll(res, {...req.params, ...req.body});
	});
	app.post('/home-detector/all/e', async (req, res) => {
		await apiHandler.getAll(res, {...req.params, ...req.body}, true);
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
	app.all([
		'/home-detector/e', 
		'/whoishome/e',
		'/whoshome/e'
	], async (req, res) => {
		webpageHandler.index(res, req, true);
	});
}