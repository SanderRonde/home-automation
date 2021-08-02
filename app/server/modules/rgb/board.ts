import SerialPort = require('serialport');
import { Color } from '../../lib/color';
import { LED_DEVICE_NAME } from '../../lib/constants';
import { logTag } from '../../lib/logger';
import { arduinoBoards, ArduinoClient } from './clients';
import {
	LedEffect,
	LedSpec,
	LedSpecStep,
	MoveData,
	MOVING_STATUS,
} from './effect-config';
import ReadLine from '@serialport/parser-readline';

export async function tryConnectToSerial(): Promise<{
	port: SerialPort;
	updateListener(listener: (line: string) => void): void;
	leds: number;
	name: string;
} | null> {
	return new Promise<{
		port: SerialPort;
		updateListener(listener: (line: string) => void): void;
		leds: number;
		name: string;
	} | null>((resolve) => {
		setTimeout(() => {
			resolve(null);
		}, 1000 * 60);

		const port = new SerialPort(LED_DEVICE_NAME, {
			baudRate: 115200,
		});

		let err = false;
		port.on('error', (e) => {
			logTag('arduino', 'red', 'Failed to connect to LED arduino', e);
			resolve(null);
			err = true;
		});

		const parser =
			// @ts-ignore
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			new ReadLine() as unknown as InstanceType<
				typeof import('@serialport/parser-readline').ReadLine
			>;
		port.pipe(parser as unknown as NodeJS.WritableStream);

		if (err) {
			resolve(null);
			return;
		}

		// Get LEDS
		setTimeout(() => {
			port.write('leds\n');
		}, 2500);

		let onData = (line: string) => {
			const LED_NUM = parseInt(line, 10);

			logTag(
				LED_DEVICE_NAME,
				'gray',
				`Connected, ${LED_NUM} leds detected`
			);

			onData = (): void => {};
			resolve({
				port,
				updateListener: (listener: (line: string) => void) => {
					logTag(
						LED_DEVICE_NAME,
						'gray',
						'<-',
						`# ${line.toString().trim()}`
					);
					onData = listener;
				},
				leds: LED_NUM,
				name: LED_DEVICE_NAME,
			});
		};

		parser.on('data', (line: string) => {
			onData(line);
		});
	});
}

export async function tryConnectBoard(force = false): Promise<Board | null> {
	if (force) {
		await Promise.all(arduinoBoards.map((b) => b.destroy()));
	}

	const res = await tryConnectToSerial();
	if (res === null) {
		return res;
	}

	return new Board(
		res.port,
		(line) => res.updateListener(line),
		res.leds,
		res.name
	);
}

export class Board {
	private _dead = false;
	public client!: ArduinoClient;

	// @ts-ignore
	constructor(
		private _port: SerialPort,
		public setListener: (listener: (line: string) => void) => void,
		public leds: number,
		public name: string
	) {
		arduinoBoards.push(this);
		this._port.addListener('data', (chunk: Buffer | string) => {
			logTag(LED_DEVICE_NAME, 'gray', '->', `${chunk.toString().trim()}`);
		});
	}

	public ping(): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			this.setListener((_line: string) => {
				resolve(true);
				this.resetListener();
			});
			this.getLeds();
			setTimeout(() => {
				resolve(false);
			}, 1000);
		});
	}

	public resetListener(): void {
		this.setListener(() => {});
	}

	public writeString(data: string): string {
		this._port.write(data);
		return data;
	}

	private _runEffect(effect: LedEffect) {
		return new Promise<number[]>((resolve) => {
			let responded = false;
			const listener = (chunk: string | Buffer) => {
				if (!responded && chunk.toString().includes('ready')) {
					responded = true;
					this._port.removeListener('data', listener);
					const bytes = new LedSpec(effect).toBytes();
					this._port.write(bytes);
					logTag(this.name, 'cyan', '<-', `${bytes.join(',')}`);
					resolve(bytes);
				}
			};
			this._port.on('data', listener);

			const interval = setInterval(() => {
				if (responded) {
					clearInterval(interval);
					return;
				}
				this._port.write('manual\n');
			}, 500);
		});
	}

	public async runEffect(
		effect: LedEffect,
		effectName: string
	): Promise<number[]> {
		this.client.updateStateEffect(effectName);
		return this._runEffect(effect);
	}

	public setSolid({
		r,
		g,
		b,
	}: {
		r: number;
		g: number;
		b: number;
	}): Promise<number[]> {
		this.client.updateStateColor(new Color(r, g, b), 100);
		return this._runEffect(
			new LedEffect([
				new LedSpecStep({
					moveData: new MoveData(MOVING_STATUS.OFF),
					background: new Color(r, g, b),
					sequences: [],
				}),
			])
		);
	}

	public setModeOff(): string {
		return this.writeString('off');
	}

	public getLeds(): string {
		return this.writeString('leds');
	}

	public destroy(): Promise<void> {
		if (this._dead) {
			return Promise.resolve(void 0);
		}

		return new Promise<void>((resolve) => {
			this._port.close(() => {
				resolve();
			});
		});
	}
}
