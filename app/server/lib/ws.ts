import { attachMessage, logOutgoingReq } from './logger';
import { errorHandle, auth } from './decorators';
import * as express from 'express';
import * as http from 'http';
import chalk from 'chalk';

function genUniqueId() {
	let id: number;
	do {
		id = Math.floor(Math.random() * 10000000);
	} while(instanceIDs.has(id));
	return id;
}
const instanceIDs = new Map<number, {
	instance: WSInstance;
	ip: string;
}>();

export class WSInstance< DATA extends {
	receive: string;
	send: string;
} = {
	receive: "";
	send: ""
}> {
	private _listeners: ({
		type: string;
		handler: (data: string, req: express.Request, res: express.Response) => void
	})[] = [{
		type: 'ping',
		handler: () => {
			this._refreshTimeoutListener();
		}
	}];
	private _ip!: string;
	private _alive: boolean = true;
	private static readonly TIMEOUT = 10 * 60 * 1000;
	private _listener: NodeJS.Timeout|null = null;

	private _init(req: express.Request, res: express.Response) {
		const id = genUniqueId();
		this._ip = {...req.body, ...req.params}.ip;

		// Store this IP alongside the ID
		instanceIDs.set(id, {
			instance: this,
			ip: this._ip
		});
		
		// Send the ID back and tell them it succeeded
		res.status(200).write(`${id}`);
		res.end();
	}

	private _refreshTimeoutListener() {
		if (this._listener) {
			clearTimeout(this._listener);
		}
		this._listener = setTimeout(() => {
			this._alive = false;
			this.onClose();
		}, WSInstance.TIMEOUT);
	}

	constructor(req: express.Request, res: express.Response) {
		this._init(req, res);
		this._refreshTimeoutListener();
	}

	send<T extends DATA['send']>(type: T, data?: string): void;
	send(type: string, data: string = '') {
		if (!this.alive) {
			console.warn('Attempting to send messages to closed instance', this._ip, type, data);
			return;
		};
		try {
			const req = http.request({
				method: 'POST',
				path: '/ws',
				hostname: this._ip,
				port: 80,
				headers: {
					'Content-Type': 'text/plain',
					'Content-Length': type.length + data.length + 1
				}
			});
			req.write(`${type} ${data}`);
			req.on('error', () => {
				this._alive = false;
			});
			req.end();

			attachMessage(req, 'Type:', chalk.bold(type), 'data:', chalk.bold(data));
			logOutgoingReq(req, {
				method: 'POST'
			});
		} catch(e) {
			this._alive = false;
		}
	}

	listen<T extends DATA['receive']>(type: T, handler: (data: string) => void): void;
	listen(type: string, handler: (data: string) => void): void {
		this._listeners.push({
			type,
			handler
		});
	}

	onMessage(req: express.Request, res: express.Response) {
		if (!this.alive) {
			res.status(401).write('Dead connection');
			res.end();
			return;
		}
		const [ , msgType, msgData ] = (<string>req.body).split(' ');
		for (const { type, handler } of this._listeners) {
			if (type === msgType) {
				attachMessage(res, 'Type:', chalk.bold(msgType), 'data:', chalk.bold(msgData));
				handler(msgData, req, res);
				if (!res.headersSent) {
					res.status(200).write('OK');
					res.end();
				}
				return;
			}
		}
	}

	onClose() { }

	get alive() {
		return this._alive;
	}

	get ip() {
		return this._ip;
	}
}

export const enum ACCEPT_STATE {
	ACCEPTED = 1,
	REJECTED = -1,
	IGNORED = 0
}

export class WSSimulator {
	private _onRequests: {
		accept: (req: express.Request, res: express.Response) => Promise<ACCEPT_STATE>,
		onAccept: (instance: WSInstance) => void
	}[] = [];

	private async _onRequest(req: express.Request, res: express.Response) {
		for (const { accept, onAccept } of this._onRequests) {
			const acceptState = await accept(req, res);
			if (acceptState === ACCEPT_STATE.ACCEPTED) {
				onAccept(new WSInstance(req, res));
				return true;
			} else if (acceptState === ACCEPT_STATE.REJECTED) {
				return true;
			}
		}
		return false;
	}

	private _handleWSMessage(req: express.Request, res: express.Response) {
		if (req.path === '/ws') {
			if (typeof req.body !== 'string') {
				res.status(400).write('Unknown data');
				res.end();
				return true;
			}
			const [ id, msgType, msgData ] = req.body.split(' ');
			if (!msgType || !msgData) {
				res.status(400).write('Missing data');
				res.end();
				return true;
			}
			if (!id) {
				res.status(400).write('Missing ID');
				res.end();
				return true;
			}

			if (!instanceIDs.has(parseInt(id, 10))) {
				res.status(401).write('Unknown ID');
				res.end();
				return true;
			}

			const { instance } = instanceIDs.get(parseInt(id, 10))!;
			instance.onMessage(req, res);
			return true;
		}
		return false;
	}

	@errorHandle
	@auth
	private async _authenticate(_res: express.Response, _params: { auth: string }): Promise<boolean> {
		return true;
	}

	all(route: string, handler: (instance: WSInstance) => void, authenticate: boolean = true) {
		const __this = this;
		this._onRequests.push({
			async accept(req: express.Request, res: express.Response) {
				if (req.path === route) {
					if (authenticate && !(await __this._authenticate(res, {...req.params, ...req.body}))) {
						return ACCEPT_STATE.REJECTED;
					}
					return ACCEPT_STATE.ACCEPTED;
				}
				return ACCEPT_STATE.IGNORED;
			},
			onAccept(instance: WSInstance) {
				handler(instance);
			}
		})
	}

	get(route: string, handler: (instance: WSInstance) => void) {
		this.all(route, handler);
	}

	post(route: string, handler: (instance: WSInstance) => void) {
		this.all(route, handler);
	}

	async handler(req: express.Request, res: express.Response, next: express.NextFunction): Promise<any> {
		if (this._handleWSMessage(req, res)) return;
		if (await this._onRequest(req, res)) {
			return;
		}
		next();
	}
}