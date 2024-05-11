import { attachMessage, logOutgoingReq } from './logger';
import { errorHandle, auth } from './decorators';
import { Server as WebsocketServer } from 'ws';
import * as express from 'express';
import * as http from 'http';
import { Socket } from 'net';
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
	},
> {
	private static readonly TIMEOUT = 10 * 60 * 60 * 1000;
	private _listeners: {
		type: string;
		handler: (
			data: string,
			req: express.Request,
			res: express.Response
		) => void;
		identifier?: string;
	}[] = [
		{
			type: 'ping',
			handler: () => {
				this.refreshTimeoutListener();
			},
		},
	];
	private _ip!: string;
	private _alive = true;
	private _listener: NodeJS.Timeout | null = null;

	public get alive(): boolean {
		return this._alive;
	}

	public get ip(): string {
		return this._ip;
	}

	public constructor(req: express.Request, res: express.Response) {
		this._init(req, res);
		this.refreshTimeoutListener();
	}

	private _init(req: express.Request, res: express.Response) {
		const id = genUniqueId();
		this._ip = (
			{
				...req.body,
				...req.params,
				...req.query,
			} as {
				ip: string;
			}
		).ip;

		// Store this IP alongside the ID
		instanceIDs.set(id, {
			instance: this,
			ip: this._ip,
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

	public refreshTimeoutListener(): void {
		if (this._listener) {
			clearTimeout(this._listener);
		}
		this._listener = setTimeout(() => {
			this._die();
			this.onClose();
		}, WSSimInstance.TIMEOUT);
	}

	public send<T extends DATA['send']>(type: T, data?: string): void;
	public send(type: string, data = ''): void {
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
					'Content-Length': type.length + data.length + 1,
				},
			});
			req.write(`${type} ${data}`);
			req.on('error', () => {
				// Just ignore this one, it'll timeout if it's really a problem
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
				target: this._ip,
			});
		} catch (e) {
			this._die();
		}
	}

	public listen<T extends DATA['receive']>(
		type: T,
		handler: (data: string) => void | Promise<void>,
		identifier?: string
	): void;
	public listen(
		type: string,
		handler: (data: string) => void | Promise<void>,
		identifier?: string
	): void {
		// Check if another listener with this identifier exists
		for (const {
			type: listenerType,
			identifier: listenerIdentifier,
		} of this._listeners) {
			if (
				identifier &&
				listenerIdentifier &&
				identifier === listenerIdentifier &&
				type === listenerType
			) {
				return;
			}
		}
		this._listeners.push({
			type,
			handler,
		});
	}

	public onMessage(req: express.Request, res: express.Response): void {
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

	public onClose(): void {}
}

export const enum ACCEPT_STATE {
	ACCEPTED = 1,
	REJECTED = -1,
	IGNORED = 0,
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
	private _authenticate(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_res: express.Response,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_params: { auth: string }
	): Promise<boolean> {
		return Promise.resolve(true);
	}

	public all(
		route: string,
		handler: (instance: WSSimInstance) => void,
		authenticate = true
	): void {
		this._onRequests.push({
			accept: async (req: express.Request, res: express.Response) => {
				if (req.path === route) {
					if (
						authenticate &&
						!(await this._authenticate(res, {
							...req.params,
							...req.body,
							...req.query,
							cookies: req.cookies,
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
			},
		});
	}

	public get(
		route: string,
		handler: (instance: WSSimInstance) => void
	): void {
		this.all(route, handler);
	}

	public post(
		route: string,
		handler: (instance: WSSimInstance) => void
	): void {
		this.all(route, handler);
	}

	public async handler(
		req: express.Request,
		res: express.Response,
		next: express.NextFunction
	): Promise<void> {
		if (this._handleWSMessage(req, res)) {
			return;
		}
		if (await this._onRequest(req, res)) {
			return;
		}
		next();
	}
}

export interface WSClient {
	send: (message: string) => void;
	addListener: (listener: (message: string) => void | Promise<void>) => void;
	onDead(handler: () => void): void;
}

type WSHandler = (args: WSClient) => void | Promise<void>;

export class WSWrapper {
	public routes: {
		route: string;
		handler: WSHandler;
	}[] = [];

	public constructor(public server: http.Server) {
		server.on(
			'upgrade',
			(req: http.IncomingMessage, socket: Socket, head: Buffer) => {
				this.handle(req, socket, head);
			}
		);
	}

	public handle(
		req: http.IncomingMessage,
		socket: Socket,
		head: Buffer
	): void {
		const pathname = new url.URL(`http://localhost${req.url!}`).pathname;
		for (const { route, handler } of this.routes) {
			if (
				pathname !== route &&
				(route.endsWith('/') || pathname !== route + '/')
			) {
				continue;
			}

			const instance = new WebsocketServer({ noServer: true });
			instance.handleUpgrade(req, socket, head, (ws) => {
				ws.emit('connection', ws, req);

				void handler({
					send(message: string) {
						ws.send(message, (err) => {
							if (err) {
								ws.emit('close');
							}
						});
					},
					addListener(messageListener) {
						ws.on('message', (data) => {
							// eslint-disable-next-line @typescript-eslint/no-base-to-string
							void messageListener(data.toString());
						});
					},
					onDead(handler) {
						ws.addEventListener('close', handler);
					},
				});
			});
			return;
		}
	}

	public all(route: string, handler: WSHandler): void {
		this.routes.push({
			route,
			handler,
		});
	}

	public post(route: string, handler: WSHandler): void {
		this.all(route, handler);
	}

	public get(route: string, handler: WSHandler): void {
		this.all(route, handler);
	}
}
