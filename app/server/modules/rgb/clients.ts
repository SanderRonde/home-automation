import chalk from 'chalk';
import { BuiltinPatterns, Control, Discovery } from 'magic-home';
import { KeyVal } from '..';
import {
	ARDUINO_LEDS,
	HEX_LEDS,
	LED_IPS,
	LED_NAMES,
	MAGIC_LEDS,
	NAME_MAP,
} from '../../lib/constants';
import { getEnv } from '../../lib/io';
import { LogObj, logTag } from '../../lib/logger';
import { Color } from '../../lib/types';
import { XHR } from '../../lib/util';
import { RGBBoard } from './board';

export namespace RGBClients {
	abstract class RGBClient {
		static patternNames: {
			[key in BuiltinPatterns]: number;
		} = Control.patternNames;
		abstract address: string;

		private async _stateChange(value: string) {
			const name = this.address;
			if (name in NAME_MAP) {
				const keys = NAME_MAP[name as keyof typeof NAME_MAP];
				for (const key of keys) {
					await new KeyVal.External.Handler(
						{},
						`RGB_NAMEMAP.${name}`
					).set(key, value, false);
				}
			}
		}

		protected async _turnedOn() {
			await this._stateChange('1');
		}

		protected async _turnedOff() {
			await this._stateChange('0');
		}

		abstract setColor(
			red: number,
			green: number,
			blue: number,
			intensity?: number,
			callback?: (err: Error | null, success: boolean) => void
		): Promise<boolean>;
		abstract setColorAndWarmWhite(
			red: number,
			green: number,
			blue: number,
			ww: number,
			callback?: (err: Error | null, success: boolean) => void
		): Promise<boolean>;
		abstract setColorWithBrightness(
			red: number,
			green: number,
			blue: number,
			brightness: number,
			intensity?: number,
			callback?: (err: Error | null, success: boolean) => void
		): Promise<boolean>;
		abstract setPattern(
			pattern: BuiltinPatterns,
			speed: number,
			callback?: () => void
		): Promise<boolean>;
		abstract setPower(on: boolean, callback?: () => void): Promise<boolean>;
		abstract setWarmWhite(
			ww: number,
			callback?: (err: Error | null, success: boolean) => void
		): Promise<boolean>;
		abstract turnOff(callback?: () => void): Promise<boolean>;
		abstract turnOn(callback?: () => void): Promise<boolean>;
	}

	export class HexClient extends RGBClient {
		constructor(public address: string) {
			super();
		}

		private _numToHex(num: number) {
			const hexed = Math.round(num).toString(16);
			if (hexed.length === 1) {
				return `${hexed}0`;
			}
			return hexed;
		}

		private _colorToHex(color: Color) {
			return `#${this._numToHex(color.r)}${this._numToHex(
				color.g
			)}${this._numToHex(color.b)}`;
		}

		async setColor(
			red: number,
			green: number,
			blue: number,
			intensity?: number
		): Promise<boolean> {
			return this.setColorWithBrightness(
				red,
				green,
				blue,
				intensity || 100
			);
		}
		async setColorAndWarmWhite(
			red: number,
			green: number,
			blue: number,
			ww: number
		): Promise<boolean> {
			return this.setColorWithBrightness(red, green, blue, ww);
		}
		async setColorWithBrightness(
			red: number,
			green: number,
			blue: number,
			brightness: number
		): Promise<boolean> {
			await XHR.post(
				`http://${this.address}/set_all`,
				`hex-${this.address}-color-with-brightness`,
				{
					color: this._colorToHex(
						new Color(
							red * (brightness / 100),
							green * (brightness / 100),
							blue * (brightness / 100)
						)
					),
				}
			);
			return Promise.resolve(true);
		}
		async setPattern(pattern: BuiltinPatterns): Promise<boolean> {
			await XHR.post(
				`http://${this.address}/effects/${pattern}`,
				`hex-${this.address}-pattern`
			);
			return Promise.resolve(true);
		}
		async setPower(on: boolean): Promise<boolean> {
			if (on) {
				await this._turnedOn();
				await this.turnOn();
			} else {
				await this._turnedOff();
				await this.turnOff();
			}
			return Promise.resolve(true);
		}

		async setWarmWhite(ww: number): Promise<boolean> {
			await XHR.post(
				`http://${this.address}/set_all`,
				`hex-${this.address}-color-warm-white`,
				{
					color: this._colorToHex(
						new Color(ww / 100, ww / 100, ww / 100)
					),
				}
			);
			return Promise.resolve(true);
		}
		async turnOff(): Promise<boolean> {
			await XHR.post(
				`http://${this.address}/off`,
				`hex-${this.address}-off`
			);
			return Promise.resolve(true);
		}
		async turnOn(): Promise<boolean> {
			await XHR.post(
				`http://${this.address}/on`,
				`hex-${this.address}-on`
			);
			return Promise.resolve(true);
		}

		async runEffect(
			name: string,
			params: Record<string, string>
		): Promise<boolean> {
			await XHR.post(
				`http://${this.address}/effects/${name}`,
				`hex-${this.address}-effect-${name}`,
				params
			);
			return Promise.resolve(true);
		}
	}

	export class MagicHomeClient extends RGBClient {
		constructor(private _control: Control, public address: string) {
			super();
		}

		async setColor(
			red: number,
			green: number,
			blue: number,
			intensity?: number,
			callback?: (err: Error | null, success: boolean) => void
		): Promise<boolean> {
			await this._turnedOn();
			return this._control.setColorWithBrightness(
				red,
				green,
				blue,
				intensity || 100,
				callback
			);
		}
		async setColorAndWarmWhite(
			red: number,
			green: number,
			blue: number,
			ww: number,
			callback?: (err: Error | null, success: boolean) => void
		): Promise<boolean> {
			await this._turnedOn();
			return this._control.setColorAndWarmWhite(
				red,
				green,
				blue,
				ww,
				callback
			);
		}
		async setColorWithBrightness(
			red: number,
			green: number,
			blue: number,
			brightness: number,
			_intensity?: number,
			callback?: (err: Error | null, success: boolean) => void
		): Promise<boolean> {
			await this._turnedOn();
			return this._control.setColorWithBrightness(
				red,
				green,
				blue,
				brightness,
				callback
			);
		}
		async setPattern(
			pattern: BuiltinPatterns,
			speed: number,
			callback?: () => void
		): Promise<boolean> {
			await this._turnedOn();
			return this._control.setPattern(pattern, speed, callback);
		}
		async setPower(on: boolean, callback?: () => void): Promise<boolean> {
			if (on) {
				await this._turnedOn();
			} else {
				await this._turnedOff();
			}
			return this._control.setPower(on, callback);
		}
		async setWarmWhite(
			ww: number,
			callback?: (err: Error | null, success: boolean) => void
		): Promise<boolean> {
			await this._turnedOn();
			return this._control.setWarmWhite(ww, callback);
		}
		async turnOff(callback?: () => void): Promise<boolean> {
			await this._turnedOff();
			return this._control.turnOff(callback);
		}
		async turnOn(callback?: () => void): Promise<boolean> {
			await this._turnedOn();
			return this._control.turnOn(callback);
		}
	}

	export class ArduinoClient extends RGBClient {
		address: string;

		constructor(public board: RGBBoard.Board) {
			super();
			this.address = board.name;
		}

		public ping(): Promise<boolean> {
			return this.board.ping();
		}

		private _sendSuccess(
			callback?: (err: Error | null, success: boolean) => void
		) {
			callback?.(null, true);
			return true;
		}

		async setColor(
			red: number,
			green: number,
			blue: number,
			_intensity?: number,
			callback?: (err: Error | null, success: boolean) => void
		): Promise<boolean> {
			await this._turnedOn();
			await this.board.setSolid({
				r: red,
				g: green,
				b: blue,
			});
			return this._sendSuccess(callback);
		}
		async setColorAndWarmWhite(
			red: number,
			green: number,
			blue: number,
			_ww: number,
			callback?: (err: Error | null, success: boolean) => void
		): Promise<boolean> {
			await this._turnedOn();
			await this.board.setSolid({ r: red, g: green, b: blue });
			return this._sendSuccess(callback);
		}
		async setColorWithBrightness(
			red: number,
			green: number,
			blue: number,
			brightness: number,
			_intensity?: number,
			callback?: (err: Error | null, success: boolean) => void
		): Promise<boolean> {
			await this._turnedOn();
			const brightnessScale = brightness / 100;
			await this.board.setSolid({
				r: red * brightnessScale,
				g: green * brightnessScale,
				b: blue * brightnessScale,
			});
			return this._sendSuccess(callback);
		}
		async setPattern(
			_pattern: BuiltinPatterns,
			_speed: number,
			_callback?: () => void
		): Promise<boolean> {
			// Not implemented
			return Promise.resolve(true);
		}
		async setPower(on: boolean, callback?: () => void): Promise<boolean> {
			if (on) {
				await this._turnedOn();
				return this.turnOn(callback);
			} else {
				await this._turnedOff();
				return this.turnOff(callback);
			}
		}
		async setWarmWhite(
			ww: number,
			callback?: (err: Error | null, success: boolean) => void
		): Promise<boolean> {
			await this._turnedOn();
			await this.board.setSolid(new Color(ww));
			return this._sendSuccess(callback);
		}
		async turnOff(callback?: () => void): Promise<boolean> {
			await this._turnedOff();
			this.board.setModeOff();
			return this._sendSuccess(callback);
		}
		async turnOn(callback?: () => void): Promise<boolean> {
			await this._turnedOn();
			return this._sendSuccess(callback);
		}
	}

	// eslint-disable-next-line prefer-const
	export let magicHomeClients: MagicHomeClient[] = [];
	export const arduinoClients: ArduinoClient[] = [];
	// eslint-disable-next-line prefer-const
	export let hexClients: HexClient[] = [];
	// eslint-disable-next-line prefer-const
	export let clients: RGBClient[] = [];

	export const arduinoBoards: RGBBoard.Board[] = [];

	export function getLed(
		name: LED_NAMES
	): MagicHomeClient | ArduinoClient | HexClient | null {
		if (MAGIC_LEDS.includes(name)) {
			return (
				magicHomeClients.filter((client) => {
					return LED_IPS[client.address] === name;
				})[0] || null
			);
		} else if (ARDUINO_LEDS.includes(name)) {
			return arduinoClients[0] || null;
		} else if (HEX_LEDS.includes(name)) {
			return hexClients[0] || null;
		}
		return null;
	}
}

export namespace RGBScan {
	let magicHomeTimer: NodeJS.Timeout | null = null;
	let arduinoTimer: NodeJS.Timeout | null = null;
	const RESCAN_TIME = 1000 * 60;

	export async function scanMagicHomeControllers(
		first = false
	): Promise<number> {
		const scanTime =
			first && process.argv.indexOf('--debug') > -1 ? 250 : 10000;
		const clients = (await new Discovery().scan(scanTime))
			.map((client) => ({
				control: new Control(client.address, {
					wait_for_reply: false,
				}),
				address: client.address,
			}))
			.map(
				(client) =>
					new RGBClients.MagicHomeClient(
						client.control,
						client.address
					)
			);

		RGBClients.magicHomeClients = clients;
		RGBClients.clients = [
			...RGBClients.magicHomeClients,
			...RGBClients.arduinoClients,
			...RGBClients.hexClients,
		];

		return clients.length;
	}

	export async function scanArduinos(): Promise<number> {
		if (RGBClients.arduinoClients.length === 0) {
			const board = await RGBBoard.tryConnectRGBBoard(true);
			if (board) {
				RGBClients.arduinoClients.push(
					new RGBClients.ArduinoClient(board)
				);
			}
		}

		RGBClients.clients = [
			...RGBClients.magicHomeClients,
			...RGBClients.arduinoClients,
			...RGBClients.hexClients,
		];

		return RGBClients.arduinoClients.length;
	}

	export function scanHex(): number {
		const ip = getEnv('MODULE_LED_HEX_IP', false);
		if (!ip) {
			return 0;
		}

		RGBClients.hexClients = [new RGBClients.HexClient(ip)];
		RGBClients.clients = [
			...RGBClients.magicHomeClients,
			...RGBClients.arduinoClients,
			...RGBClients.hexClients,
		];

		return 1;
	}

	export async function scanRGBControllers(
		first = false,
		logObj: LogObj = undefined
	): Promise<number> {
		const [magicHomeClients, arduinoClients, hexClients] =
			await Promise.all([
				scanMagicHomeControllers(first),
				scanArduinos(),
				scanHex(),
			]);
		const clients = magicHomeClients + arduinoClients + hexClients;

		if (magicHomeClients === 0) {
			if (magicHomeTimer !== null) {
				clearInterval(magicHomeTimer);
			}
			magicHomeTimer = setTimeout(async () => {
				await scanMagicHomeControllers();
				if (magicHomeTimer !== null) {
					clearInterval(magicHomeTimer);
				}
			}, RESCAN_TIME);
		}
		if (arduinoClients === 0) {
			if (arduinoTimer !== null) {
				clearInterval(arduinoTimer);
			}
			arduinoTimer = setTimeout(async () => {
				await scanArduinos();
				if (arduinoTimer !== null) {
					clearInterval(arduinoTimer);
				}
			}, RESCAN_TIME);
		}

		if (!logObj) {
			logTag(
				'rgb',
				'cyan',
				'Found',
				chalk.bold(String(clients)),
				'clients'
			);
		} else {
			logTag(
				'rgb',
				'cyan',
				'Found',
				chalk.bold(String(clients)),
				'clients'
			);
		}

		return clients;
	}
}
