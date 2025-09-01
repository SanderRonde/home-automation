import * as React from 'react';

interface Options<IN = unknown> {
	url: string;
	onOpen: (this: ResilientSocket) => void;
	onError?: (this: ResilientSocket, event: Event) => void;
	onClose?: (this: ResilientSocket) => void;
	onMessage?: (this: ResilientSocket, message: IN) => void;
}

/**
 * Websocket instance that auto-reconnects
 */
class ResilientSocket<OUT = unknown, IN = unknown> {
	private _ws: undefined | WebSocket;
	// While active, keep trying to open the socket
	private _started: boolean = false;
	// True when the socket is currently open
	private _opened: boolean = false;
	// Time after which a reconnect should be attempted
	private _reconnectTime: number = 1000;
	private _connectT: ReturnType<typeof setTimeout> | undefined = undefined;

	public constructor(private readonly _options: Options<IN>) {}

	/** Setup websocket and keep trying to open it when it disconnects */
	public start(): void {
		if (!this._started) {
			this.#connect();
			this._started = true;
		}
	}

	/**
	 * @return boolean false when the socket is closed and the message cannot be sent, true when an attempt to sent has been made
	 */
	public send(message: OUT): boolean {
		if (!this._opened) {
			return false;
		}

		if (!this._ws) {
			throw new Error('Missing WebSocket while it should be open');
		}
		this._ws.send(JSON.stringify(message));
		return true;
	}

	/** Close the websocket, keep closed until start() is called again */
	public stop(): void {
		this._started = false;
		this.#close();
	}

	/** Close and cleanup the current connection */
	readonly #close = () => {
		if (this._ws) {
			if (this._ws.readyState === WebSocket.CONNECTING) {
				const ws = this._ws;
				this._ws.onopen = () => {
					ws.close();
				};
			} else {
				this._ws.close();
			}
		}
		clearTimeout(this._connectT);
		this._opened = false;
		this._ws = undefined;
	};

	readonly #connect = () => {
		const ws = new WebSocket(this._options.url);
		ws.onopen = this.#onOpen;
		ws.onerror = this.#onError;
		ws.onclose = this.#onClose;
		ws.onmessage = this.#onMessage;
		this._ws = ws;
	};

	readonly #onOpen = () => {
		this._opened = true;

		// Reset reconnect time, next retry should be quick again
		this._reconnectTime = 1000;

		if (this._options.onOpen) {
			this._options.onOpen.call(this);
		}
	};

	readonly #onError = (e: Event) => {
		if (this._options.onError) {
			this._options.onError.call(this, e);
		}
	};

	readonly #onClose = (...args: unknown[]) => {
		this.#close();

		// Schedule reconnect
		if (this._started) {
			this._reconnectTime = Math.min(
				Math.round(this._reconnectTime * 1.1),
				30 * 1000
			);
			this._connectT = setTimeout(this.#connect, this._reconnectTime);
		}

		if (this._options.onClose) {
			this._options.onClose.call(this);
		}
	};

	readonly #onMessage = ({ data }: MessageEvent) => {
		if (!this._opened) {
			return;
		}
		// Assume JSON data
		const message = JSON.parse(data);

		if (this._options.onMessage) {
			this._options.onMessage.call(this, message);
		}
	};
}

interface Result<OUT> {
	open: boolean;
	sendMessage: (message: OUT) => void;
}

function useWebsocket<IN, OUT>(
	path: null | string,
	options: {
		onMessage?: (message: IN) => void;
	} = {}
): Result<OUT> {
	// Not ideal, but we need to make sure we're mounted when setting open to false
	// on onClose.
	const mounted = React.useRef(false);
	React.useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	const onMessage = options.onMessage;

	const [open, setOpen] = React.useState(false);

	const socket = React.useRef<null | ResilientSocket<OUT, IN>>(null);
	React.useEffect(() => {
		if (!path) {
			return;
		}
		socket.current = new ResilientSocket<OUT, IN>({
			url: `ws://${location.host}${path}`,
			onOpen() {
				setOpen(true);
			},
			onClose() {
				if (mounted.current) {
					setOpen(false);
				}
			},
			onMessage(data: IN) {
				onMessage?.(data);
			},
		});
		socket.current.start();
		return () => {
			socket.current?.stop();
		};
	}, [path, onMessage]);

	const sendMessage = React.useCallback((message: OUT) => {
		socket.current?.send(message);
	}, []);

	return { open, sendMessage };
}

export default useWebsocket;
