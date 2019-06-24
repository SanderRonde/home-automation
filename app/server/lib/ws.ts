import { server, request, connection } from 'websocket';

export class WSInstance< DATA extends {
	receive: string;
	send: string;
} = {
	receive: "";
	send: ""
}> {
	private _connection: connection;
	private _listeners: ({
		type: string;
		handler: (data: string) => void
	})[] = [];

	constructor(private _request: request) { 
		this._connection = this._request.accept(null as any, _request.origin);
		this._connection.on('message', (msg) => {
			console.log('Got msg', msg);
			if (msg.type !== 'utf8') return;
			try {
				const [ msgType, msgData ] = msg.utf8Data!.split(' ');
				for (const { type, handler } of this._listeners) {
					if (type === msgType) {
						handler(msgData);
						return;
					}
				}
			} catch(e) {
				return;
			}
		});
		this._connection.on('close', () => {
			this.onClose();
		});
	}

	send<T extends DATA['send']>(type: T, data?: string): void;
	send(type: string, data: string = '') {
		this._connection.sendUTF(`${type} ${data}`);
	}

	listen<T extends DATA['receive']>(type: T, handler: (data: string) => void): void;
	listen(type: string, handler: (data: string) => void): void {
		this._listeners.push({
			type,
			handler
		});
	}

	onClose() { }

	close() {
		this._connection.close();
		this.onClose();
	}
}

export class WSWrapper {
	private _onRequests: {
		accept: (request: request) => boolean,
		onAccept: (instance: WSInstance) => void
	}[] = [];
	private _dead: boolean = false;
	private _activeInstances: WSInstance[] = [];

	private _onRequest(request: request) {
		for (const { accept, onAccept } of this._onRequests) {
			if (accept(request)) {
				onAccept(new WSInstance(request));
				return;
			}
		}
		request.reject(404, 'No valid handler');
	}

	constructor(server: server) { 
		server.on('request', (request: request) => {
			this._onRequest(request);
		});
		server.on('close', () => { 
			this._dead = true;
			this._activeInstances.forEach(i => i.onClose());
		});
	}

	all(route: string, handler: (instance: WSInstance) => void) {
		this._onRequests.push({
			accept(request: request) {
				return request.resourceURL.path === route;
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

	get dead() {
		return this._dead;
	}
}