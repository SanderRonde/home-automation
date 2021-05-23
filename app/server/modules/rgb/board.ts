import { ReadLine } from '@serialport/parser-readline';
import SerialPort = require('serialport');
import { LED_DEVICE_NAME } from '../../lib/constants';
import { logTag } from '../../lib/logger';
import { Color } from '../../lib/types';
import { RGBClients } from './clients';
import { RGBEffectConfig } from './effect-config';

export namespace RGBBoard {
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
				console.log('immediately got an error', e);
				logTag('arduino', 'red', 'Failed to connect to LED arduino', e);
				resolve(null);
				err = true;
			});

			//@ts-ignore
			const parser = new ReadLine();
			//@ts-ignore
			port.pipe(parser);

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
							`# ${line.toString()}`
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

	export async function tryConnectRGBBoard(
		force = false
	): Promise<Board | null> {
		if (force) {
			await Promise.all(RGBClients.arduinoBoards.map((b) => b.destroy()));
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

		// @ts-ignore
		constructor(
			private _port: SerialPort,
			public setListener: (listener: (line: string) => void) => void,
			public leds: number,
			public name: string
		) {
			RGBClients.arduinoBoards.push(this);
			this._port.addListener('data', (chunk: Buffer | string) => {
				logTag(LED_DEVICE_NAME, 'gray', '->', `${chunk.toString()}`);
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

		public async runEffect(
			effect: RGBEffectConfig.LedEffect
		): Promise<number[]> {
			return new Promise((resolve) => {
				let responded = false;
				const listener = (chunk: string | Buffer) => {
					if (!responded && chunk.toString().includes('ready')) {
						responded = true;
						this._port.removeListener('data', listener);
						const bytes = new RGBEffectConfig.LedSpec(
							effect
						).toBytes();
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

		public setSolid({
			r,
			g,
			b,
		}: {
			r: number;
			g: number;
			b: number;
		}): Promise<number[]> {
			return this.runEffect(
				new RGBEffectConfig.LedEffect([
					new RGBEffectConfig.LedSpecStep({
						moveData: new RGBEffectConfig.MoveData(
							RGBEffectConfig.MOVING_STATUS.OFF
						),
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
}
