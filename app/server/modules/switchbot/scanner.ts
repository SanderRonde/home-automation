import type { SwitchbotDeviceBase } from './devices/devices';
import { createSwitchbots } from '../../config/switchbot';
import { EventEmitter } from '../../lib/event-emitter';
import { logTag } from '../../lib/logging/logger';
import { ROOT } from '../../lib/constants';
import { wait } from '../../lib/util';
import { spawn } from 'child_process';
import type { AllModules } from '..';
import type { Socket } from 'net';
import { existsSync } from 'fs';
import { connect } from 'net';
import path from 'path';

const SOCKET_PATH = path.join(ROOT, 'switchbot.sock');
const VENV_PYTHON = '.venv/bin/python';

export async function scanSwitchbots(
	modules: AllModules
): Promise<SwitchbotDeviceBase[]> {
	// Check if virtual env exists
	if (!existsSync(VENV_PYTHON)) {
		throw new Error(
			'Virtual environment not found. Please run "python -m venv .venv" and "pip install -r requirements.txt"'
		);
	}

	// Spawn Python process using venv and ensure it's killed when parent process exits
	const pythonProcess = spawn(VENV_PYTHON, [
		path.join('switchbot', 'main.py'),
		SOCKET_PATH,
	]);

	pythonProcess.stdout.on('data', (data) => {
		console.log(data.toString());
	});

	pythonProcess.stderr.on('data', (data) => {
		console.error(data.toString());
	});

	// Kill Python process when Node process exits
	process.on('exit', () => {
		pythonProcess.kill();
	});

	// Handle other termination signals
	['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((signal) => {
		process.on(signal, () => {
			pythonProcess.kill();
			// eslint-disable-next-line no-process-exit
			process.exit();
		});
	});

	const api = new SwitchBotAPI(SOCKET_PATH);
	await wait(500);
	api.connect();

	return await createSwitchbots(modules, api);
}

interface SwitchBotCommand {
	mac: string;
	action: 'open' | 'close';
}

export type SwitchbotAdvertisement = {
	position: number;
	mac: string;
};

class SwitchBotAPI {
	private socket: Socket | null = null;
	private connected: boolean = false;
	private reconnectTimeout: number = 1000; // Start with 1 second
	private reconnecting: boolean = false; // Flag to prevent multiple simultaneous reconnect attempts
	private messageListeners: Map<
		string,
		EventEmitter<SwitchbotAdvertisement>
	> = new Map();

	public constructor(private socketPath: string = SOCKET_PATH) {}

	public onMessage(mac: string): EventEmitter<SwitchbotAdvertisement> {
		let listener = this.messageListeners.get(mac);
		if (!listener) {
			listener = new EventEmitter<SwitchbotAdvertisement>();
			this.messageListeners.set(mac, listener);
		}
		return listener;
	}

	public connect(): void {
		if (this.reconnecting) {
			return; // Prevent multiple connect attempts
		}
		this.reconnecting = true;
		try {
			this.socket = connect({ path: this.socketPath });

			this.connected = true;
			this.reconnectTimeout = 10000; // Reset timeout on successful connection
			this.reconnecting = false; // Reset reconnecting flag
			logTag('switchbot', 'blue', 'Connected to SwitchBot controller');

			// Set up message handling
			this.socket.on('data', this.handleResponse.bind(this));
			this.socket.on('error', this.handleError.bind(this));
			this.socket.on('close', this.handleDisconnect.bind(this));
		} catch (error) {
			console.error('Failed to connect:', error);
			this.handleDisconnect();
		}
	}

	private handleResponse(data: Buffer): void {
		const response = data.toString().trim();

		try {
			const message = JSON.parse(response) as SwitchbotAdvertisement;

			const listener = this.messageListeners.get(message.mac);
			if (listener) {
				listener.emit(message);
			}
		} catch (error) {
			logTag(
				'switchbot',
				'red',
				'Failed to parse response:',
				error,
				response
			);
		}
	}

	private handleError(error: Error): void {
		console.error('Socket error:', error);
		this.handleDisconnect();
	}

	private handleDisconnect(): void {
		this.connected = false;
		this.socket?.end();
		this.socket = null;

		// Exponential backoff for reconnection
		setTimeout(() => {
			logTag('switchbot', 'blue', 'Attempting to reconnect...');
			this.connect();
			this.reconnectTimeout = Math.min(this.reconnectTimeout * 2, 30000); // Max 30 seconds
		}, this.reconnectTimeout);
	}

	public sendCommand(command: SwitchBotCommand): void {
		if (!this.connected || !this.socket) {
			throw new Error('Not connected to SwitchBot controller');
		}

		this.socket.write(JSON.stringify(command) + '\n');
	}
}

export { SwitchBotAPI, type SwitchBotCommand };
