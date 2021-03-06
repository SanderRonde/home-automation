import { attachMessage, logOutgoingReq } from './logger';
import { errorHandle, auth } from './decorators';
import { Server as WebsocketServer } from 'ws';
import * as express from 'express';
import { Socket } from 'net';
import * as http from 'http';
import * as url from 'url';
import chalk from 'chalk';

function genUniqueId() {
	let id: number;
	do {
		id = Math.floor(Math.random() * 10000000);
	} while (instanceIDs.has(id));
	return id;
}
const instanceIDs = new Map<
	number,
	{
		instance: WSSimInstance;
		ip: string;
	}
>();
const instanceMap = new Map<WSSimInstance, number>();

export class WSSimInstance<
	DATA extends {
		receive: string;
		send: string;
	} = {
		receive: '';
		send: '';
	}
> {
	private _listeners: {
		type: string;
		handler: (
			data: string,
			req: express.Request,
			res: express.Response
		) => void;
		identifier?: any;
	}[] = [
		{
			type: 'ping',
			handler: () => {
				this.refreshTimeoutListener();
			}
		}
	];
	private _ip!: string;
	private _alive: boolean = true;
	private static readonly TIMEOUT = 10 * 60 * 1000;
	private _listener: NodeJS.Timeout | null = null;

	private _init(req: express.Request, res: express.Response) {
		const id = genUniqueId();
		this._ip = { ...req.body, ...req.params }.ip;

		// Store this IP alongside the ID
		instanceIDs.set(id, {
			instance: this,
			ip: this._ip
		});
		instanceMap.set(this, id);

		// Send the ID back and tell them it succeeded
		res.status(200).write(`${id}`);
		res.end();
	}

	private _die() {
		this._alive = false;
		instanceIDs.delete(instanceMap.get(this)!);
	}

	public refreshTimeoutListener() {
		if (this._listener) {
			clearTimeout(this._listener);
		}
		this._listener = setTimeout(() => {
			this._die();
			this.onClose();
		}, WSSimInstance.TIMEOUT);
	}

	constructor(req: express.Request, res: express.Response) {
		this._init(req, res);
		this.refreshTimeoutListener();
	}

	send<T extends DATA['send']>(type: T, data?: string): void;
	send(type: string, data: string = '') {
		if (!this.alive) {
			console.warn(
				'Attempting to send messages to closed instance',
				this._ip,
				type,
				data
			);
			return;
		}
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
				this._die();
			});
			req.end();

			attachMessage(
				req,
				chalk.cyan('[ws]'),
				'Type:',
				chalk.bold(type),
				'data:',
				chalk.bold(data)
			);
			logOutgoingReq(req, {
				method: 'POST',
				target: this._ip
			});
		} catch (e) {
			this._die();
		}
	}

	listen<T extends DATA['receive']>(
		type: T,
		handler: (data: string) => void,
		identifier?: any
	): void;
	listen(
		type: string,
		handler: (data: string) => void,
		identifier?: any
	): void {
		// Check if another listener with this identifier exists
		for (const {
			type: listenerType,
			identifier: listenerIdentifier
		} of this._listeners) {
			if (
				identifier &&
				listenerIdentifier &&
				identifier === listenerIdentifier &&
				type === listenerType
			)
				return;
		}
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
		const [, msgType, ...msgDataParts] = (<string>req.body).split(' ');
		const msgData = msgDataParts.join(' ');
		for (const { type, handler } of this._listeners) {
			if (type === msgType) {
				attachMessage(
					res,
					'Type:',
					chalk.bold(msgType),
					'data:',
					chalk.bold(msgData)
				);
				handler(msgData, req, res);
				if (!res.headersSent) {
					res.status(200).write('OK');
					res.end();
				}
				return;
			}
		}
	}

	onClose() {}

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
		accept: (
			req: express.Request,
			res: express.Response
		) => Promise<ACCEPT_STATE>;
		onAccept: (instance: WSSimInstance) => void;
	}[] = [];

	private async _onRequest(req: express.Request, res: express.Response) {
		for (const { accept, onAccept } of this._onRequests) {
			const acceptState = await accept(req, res);
			if (acceptState === ACCEPT_STATE.ACCEPTED) {
				onAccept(new WSSimInstance(req, res));
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
			const [id, msgType, msgData] = req.body.split(' ');
			if (!msgType) {
				res.status(400).write('Missing type');
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

			if (msgType === 'ping') {
				instanceIDs
					.get(parseInt(id, 10))!
					.instance.refreshTimeoutListener();
				attachMessage(res, `ping from ${id}`);
				res.status(200).write('OK');
				res.end();
				return true;
			}

			if (!msgData) {
				res.status(400).write('Missing data');
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
	private async _authenticate(
		_res: express.Response,
		_params: { auth: string }
	): Promise<boolean> {
		return true;
	}

	all(
		route: string,
		handler: (instance: WSSimInstance) => void,
		authenticate: boolean = true
	) {
		const __this = this;
		this._onRequests.push({
			async accept(req: express.Request, res: express.Response) {
				if (req.path === route) {
					if (
						authenticate &&
						!(await __this._authenticate(res, {
							...req.params,
							...req.body,
							cookies: req.cookies
						}))
					) {
						return ACCEPT_STATE.REJECTED;
					}
					return ACCEPT_STATE.ACCEPTED;
				}
				return ACCEPT_STATE.IGNORED;
			},
			onAccept(instance: WSSimInstance) {
				handler(instance);
			}
		});
	}

	get(route: string, handler: (instance: WSSimInstance) => void) {
		this.all(route, handler);
	}

	post(route: string, handler: (instance: WSSimInstance) => void) {
		this.all(route, handler);
	}

	async handler(
		req: express.Request,
		res: express.Response,
		next: express.NextFunction
	): Promise<any> {
		if (this._handleWSMessage(req, res)) return;
		if (await this._onRequest(req, res)) {
			return;
		}
		next();
	}
}

export interface WSClient {
	send: (message: string) => void;
	addListener: (listener: (message: string) => void) => void;
	onDead(handler: () => void): void;
}

type WSHandler = (args: WSClient) => void;

export class WSWrapper {
	routes: {
		route: string;
		handler: WSHandler;
	}[] = [];

	constructor(public server: http.Server) {
		server.on(
			'upgrade',
			(req: http.IncomingMessage, socket: Socket, head: any) => {
				this.handle(req, socket, head);
			}
		);
	}

	handle(req: http.IncomingMessage, socket: Socket, head: any) {
		const pathname = url.parse(req.url!).pathname;
		for (const { route, handler } of this.routes) {
			if (
				pathname !== route &&
				(route.endsWith('/') || pathname !== route + '/')
			) {
				continue;
			}

			const instance = new WebsocketServer({ noServer: true });
			instance.handleUpgrade(req, socket, head, ws => {
				ws.emit('connection', ws, req);

				handler({
					send(message: string) {
						ws.send(message, err => {
							if (err) {
								ws.emit('close');
							}
						});
					},
					addListener(messageListener) {
						ws.on('message', data => {
							messageListener(data.toString());
						});
					},
					onDead(handler) {
						ws.addEventListener('close', handler);
					}
				});
			});
			return;
		}
	}

	all(route: string, handler: WSHandler) {
		this.routes.push({
			route,
			handler
		});
	}

	post(route: string, handler: WSHandler) {
		this.all(route, handler);
	}

	get(route: string, handler: WSHandler) {
		this.all(route, handler);
	}
}
