import {
	SERIAL_MAX_ATTEMPTS,
	SERIAL_MSG_INTERVAL,
	LED_NAMES,
	NIGHTSTAND_COLOR,
	LED_DEVICE_NAME,
	MAGIC_LEDS,
	ARDUINO_LEDS,
	LED_IPS,
	WAKELIGHT_TIME,
	NAME_MAP
} from '../lib/constants';
import {
	errorHandle,
	requireParams,
	auth,
	authCookie,
	authAll,
	upgradeToHTTPS
} from '../lib/decorators';
import {
	Discovery,
	Control,
	CustomMode,
	TransitionTypes,
	BuiltinPatterns
} from 'magic-home';
import { attachMessage, ResDummy, getTime, log } from '../lib/logger';
import * as ReadLine from '@serialport/parser-readline';
import { BotState } from '../lib/bot-state';
import { AppWrapper } from '../lib/routes';
import SerialPort = require('serialport');
import { BotUtil } from '../lib/bot-util';
import { colorList } from '../lib/data';
import { ResponseLike } from './multi';
import { WSWrapper } from '../lib/ws';
import { exec } from 'child_process';
import { Bot as _Bot } from './bot';
import { Auth } from '../lib/auth';
import * as express from 'express';
import { KeyVal } from './keyval';
import chalk from 'chalk';

function speedToMs(speed: number) {
	return 1000 / speed;
}

function getIntensityPercentage(percentage: number) {
	return Math.round((percentage / 100) * 255);
}

export interface Color {
	r: number;
	g: number;
	b: number;
}
export class Color implements Color {
	constructor(r: number);
	constructor(r: number, g: number, b: number);
	constructor(r: number, g: number = r, b: number = r) {
		this.r = r;
		this.g = g;
		this.b = b;
	}

	toJSON?() {
		return {
			r: this.r,
			g: this.g,
			b: this.b
		};
	}
}

function restartSelf() {
	return new Promise(resolve => {
		// Find this program in the forever list
		exec('sudo -u root su -c "forever list"', (err, stdout, stderr) => {
			if (err) {
				console.log('Failed to restart :(', stderr);
				resolve();
				return;
			}

			const lines = stdout.split('\n');
			for (const line of lines) {
				if (line.indexOf('automation') !== -1) {
					const index = line.split('[')[1].split(']')[0];

					// Restart that (this) program
					exec(
						`sudo -u root su -c "forever restart ${index}"`,
						(err, _stdout, stderr) => {
							if (err) {
								console.log('Failed to restart :(', stderr);
								resolve();
								return;
							}
							resolve();
						}
					);
				}
			}
		});
	});
}

export namespace RGB {
	export namespace Clients {
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
						await new KeyVal.External.Handler({}).set(
							key,
							value,
							false
						);
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
			abstract setCustomPattern(
				pattern: CustomMode,
				speed: number,
				callback?: () => void
			): Promise<boolean>;
			abstract setPattern(
				pattern: BuiltinPatterns,
				speed: number,
				callback?: () => void
			): Promise<boolean>;
			abstract setPower(
				on: boolean,
				callback?: () => void
			): Promise<boolean>;
			abstract setWarmWhite(
				ww: number,
				callback?: (err: Error | null, success: boolean) => void
			): Promise<boolean>;
			abstract turnOff(callback?: () => void): Promise<boolean>;
			abstract turnOn(callback?: () => void): Promise<boolean>;
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
			async setCustomPattern(
				pattern: CustomMode,
				speed: number,
				callback?: () => void
			): Promise<boolean> {
				await this._turnedOn();
				return this._control.setCustomPattern(pattern, speed, callback);
			}
			async setPattern(
				pattern: BuiltinPatterns,
				speed: number,
				callback?: () => void
			): Promise<boolean> {
				await this._turnedOn();
				return this._control.setPattern(pattern, speed, callback);
			}
			async setPower(
				on: boolean,
				callback?: () => void
			): Promise<boolean> {
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

			constructor(public board: Board.Board) {
				super();
				this.address = board.name;
			}

			public ping(): Promise<boolean> {
				return this.board.ping();
			}

			private _sendSuccess(
				callback?: (err: Error | null, success: boolean) => void
			) {
				callback && callback(null, true);
				return true;
			}

			async setColor(
				red: number,
				green: number,
				blue: number,
				intensity?: number,
				callback?: (err: Error | null, success: boolean) => void
			): Promise<boolean> {
				await this._turnedOn();
				await this.board.setSolid({
					r: red,
					g: green,
					b: blue,
					intensity
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
				intensity?: number,
				callback?: (err: Error | null, success: boolean) => void
			): Promise<boolean> {
				await this._turnedOn();
				const brightnessScale = brightness / 100;
				await this.board.setSolid({
					r: red * brightnessScale,
					g: green * brightnessScale,
					b: blue * brightnessScale,
					intensity
				});
				return this._sendSuccess(callback);
			}
			async setCustomPattern(
				pattern: CustomMode,
				speed: number,
				callback?: () => void
			): Promise<boolean> {
				await this._turnedOn();
				await this.board.setFlash({
					colors: pattern.colors.map(
						({ red, green, blue }) => new Color(red, green, blue)
					),
					mode: pattern.transitionType,
					updateTime: speedToMs(speed)
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
			async setPower(
				on: boolean,
				callback?: () => void
			): Promise<boolean> {
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
				await this.board.setModeOff();
				return this._sendSuccess(callback);
			}
			async turnOn(callback?: () => void): Promise<boolean> {
				await this._turnedOn();
				return this._sendSuccess(callback);
			}
		}

		export let magicHomeClients: MagicHomeClient[] = [];
		export let arduinoClients: ArduinoClient[] = [];
		export let clients: RGBClient[] = [];

		export let arduinoBoards: Board.Board[] = [];

		export function getLed(
			name: LED_NAMES
		): MagicHomeClient | ArduinoClient | null {
			if (MAGIC_LEDS.includes(name)) {
				return (
					magicHomeClients.filter(client => {
						return LED_IPS[client.address] === name;
					})[0] || null
				);
			} else if (ARDUINO_LEDS.includes(name)) {
				return arduinoClients[0] || null;
			}
			return null;
		}
	}

	export namespace Scan {
		let magicHomeTimer: NodeJS.Timeout | null = null;
		let arduinoTimer: NodeJS.Timeout | null = null;
		const RESCAN_TIME = 1000 * 60;

		export async function scanMagicHomeControllers(first: boolean = false) {
			const scanTime =
				first && process.argv.indexOf('--debug') > -1 ? 250 : 10000;
			const clients = (await new Discovery().scan(scanTime))
				.map(client => ({
					control: new Control(client.address, {
						wait_for_reply: false
					}),
					address: client.address
				}))
				.map(
					client =>
						new Clients.MagicHomeClient(
							client.control,
							client.address
						)
				);

			Clients.magicHomeClients = clients;
			Clients.clients = [
				...Clients.magicHomeClients,
				...Clients.arduinoClients
			];

			return clients.length;
		}

		export async function scanArduinos() {
			if (Clients.arduinoClients.length === 0) {
				const board = await Board.tryConnectRGBBoard(true);
				if (board) {
					Clients.arduinoClients.push(
						new Clients.ArduinoClient(board)
					);
				}
			}

			Clients.clients = [
				...Clients.magicHomeClients,
				...Clients.arduinoClients
			];

			return Clients.arduinoClients.length;
		}

		export async function scanRGBControllers(
			first: boolean = false,
			logObj: any = undefined
		) {
			const [magicHomeClients, arduinoClients] = await Promise.all([
				scanMagicHomeControllers(first),
				scanArduinos()
			]);
			const clients = magicHomeClients + arduinoClients;

			if (magicHomeClients === 0) {
				if (magicHomeTimer !== null) {
					clearInterval(magicHomeTimer);
				}
				magicHomeTimer = setTimeout(() => {
					scanMagicHomeControllers();
					magicHomeTimer !== null && clearInterval(magicHomeTimer);
				}, RESCAN_TIME);
			}
			if (arduinoClients === 0) {
				if (arduinoTimer !== null) {
					clearInterval(arduinoTimer);
				}
				arduinoTimer = setTimeout(() => {
					scanArduinos();
					arduinoTimer !== null && clearInterval(arduinoTimer);
				}, RESCAN_TIME);
			}

			if (!logObj) {
				log(
					getTime(),
					chalk.cyan(`[rgb]`),
					'Found',
					chalk.bold(clients + ''),
					'clients'
				);
			} else {
				attachMessage(
					logObj,
					getTime(),
					chalk.cyan(`[rgb]`),
					'Found',
					chalk.bold(clients + ''),
					'clients'
				);
			}

			return clients;
		}
	}

	type CustomPattern =
		| 'rgb'
		| 'rainbow'
		| 'christmas'
		| 'strobe'
		| 'darkcolors'
		| 'shittyfire'
		| 'betterfire';

	const patterns: Object &
		{
			[K in CustomPattern]: {
				pattern: CustomMode;
				defaultSpeed: number;
				arduinoOnly?: boolean;
			};
		} = {
		rgb: {
			pattern: new CustomMode()
				.addColor(255, 0, 0)
				.addColor(0, 255, 0)
				.addColor(0, 0, 255)
				.setTransitionType('fade'),
			defaultSpeed: 100
		},
		rainbow: {
			pattern: new CustomMode()
				.addColor(255, 0, 0)
				.addColor(255, 127, 0)
				.addColor(255, 255, 0)
				.addColor(0, 255, 0)
				.addColor(0, 0, 255)
				.addColor(75, 0, 130)
				.addColor(143, 0, 255)
				.setTransitionType('fade'),
			defaultSpeed: 100
		},
		christmas: {
			pattern: new CustomMode()
				.addColor(255, 61, 42)
				.addColor(0, 239, 0)
				.setTransitionType('jump'),
			defaultSpeed: 70
		},
		strobe: {
			pattern: new CustomMode()
				.addColor(255, 255, 255)
				.addColor(255, 255, 255)
				.addColor(255, 255, 255)
				.setTransitionType('strobe'),
			defaultSpeed: 100
		},
		darkcolors: {
			pattern: new CustomMode()
				.addColor(255, 0, 0)
				.addColor(255, 0, 85)
				.addColor(255, 0, 170)
				.addColor(255, 0, 255)
				.addColor(170, 0, 255)
				.addColor(85, 0, 255)
				.addColor(25, 0, 255)
				.addColor(0, 0, 255)
				.addColor(25, 0, 255)
				.addColor(85, 0, 255)
				.addColor(170, 0, 255)
				.addColor(255, 0, 255)
				.addColor(255, 0, 170)
				.addColor(255, 0, 85)
				.setTransitionType('fade'),
			defaultSpeed: 90
		},
		shittyfire: {
			pattern: new CustomMode()
				.addColor(255, 0, 0)
				.addColor(255, 25, 0)
				.addColor(255, 85, 0)
				.addColor(255, 170, 0)
				.addColor(255, 230, 0)
				.addColor(255, 255, 0)
				.addColor(255, 230, 0)
				.addColor(255, 170, 0)
				.addColor(255, 85, 0)
				.addColor(255, 25, 0)
				.addColor(255, 0, 0)
				.setTransitionType('fade'),
			defaultSpeed: 90
		},
		betterfire: {
			pattern: new CustomMode()
				.addColorList(
					new Array(15).fill('').map(() => {
						return [
							255 - Math.random() * 90,
							200 - Math.random() * 200,
							0
						] as [number, number, number];
					})
				)
				.setTransitionType('fade'),
			defaultSpeed: 100
		}
	};

	namespace ArduinoAPI {
		export const enum DIR {
			DIR_FORWARDS = 1,
			DIR_BACKWARDS = 0
		}

		export interface Solid {
			intensity?: number;
			r: number;
			g: number;
			b: number;
		}

		export interface Dot {
			intensity?: number;
			backgroundRed: number;
			backgroundGreen: number;
			backgroundBlue: number;
			dots: {
				size: number;
				speed: number;
				dir: DIR;
				dotPos: number;
				r: number;
				g: number;
				b: number;
			}[];
		}

		export interface Split {
			intensity?: number;
			updateTime: number;
			dir: DIR;
			parts: Color[];
		}

		export interface Pattern {
			intensity?: number;
			updateTime: number;
			blockSize?: number;
			dir: DIR;
			parts: Color[];
		}

		export interface Flash {
			intensity?: number;
			updateTime: number;
			mode: TransitionTypes;
			blockSize?: number;
			colors?: Color[];
		}

		export interface Rainbow {
			updateTime: number;
			blockSize?: number;
		}

		export type ArduinoConfig =
			| {
					type: 'solid';
					data: Solid;
			  }
			| {
					type: 'dot';
					data: Dot;
			  }
			| {
					type: 'split';
					data: Split;
			  }
			| {
					type: 'pattern';
					data: Pattern;
			  }
			| {
					type: 'flash';
					data: Flash;
			  }
			| {
					type: 'rainbow';
					data: Rainbow;
			  }
			| {
					type: 'off';
			  }
			| {
					type: 'prime';
			  };

		export type JoinedConfigs = Partial<
			Solid & Dot & Split & Pattern & Flash
		>;

		export type Effects =
			| 'rainbow'
			| 'reddot'
			| 'reddotbluebg'
			| 'multidot'
			| 'split'
			| 'rgb'
			| 'quickstrobe'
			| 'strobe'
			| 'slowstrobe'
			| 'brightstrobe'
			| 'epileptisch'
			| 'quickfade'
			| 'slowfade'
			| 'rainbow2'
			| 'desk';

		function interpolate(
			c1: Color,
			c2: Color,
			steps: number,
			{
				start = true,
				end = true
			}: {
				start?: boolean;
				end?: boolean;
			} = {}
		) {
			const stops: Color[] = [];
			if (start) {
				stops.push(c1);
			}

			let delta = 1 / steps;
			for (let i = 1; i < steps - 1; i++) {
				const progress = delta * i;
				const invertedProgress = 1 - progress;
				stops.push(
					new Color(
						Math.round(invertedProgress * c1.r + progress * c2.r),
						Math.round(invertedProgress * c1.g + progress * c2.g),
						Math.round(invertedProgress * c1.b + progress * c2.b)
					)
				);
			}

			if (end) {
				stops.push(c2);
			}
			return stops;
		}

		export const arduinoEffects: Object &
			{
				[K in Effects]: ArduinoConfig;
			} = {
			rainbow: {
				type: 'pattern',
				data: {
					updateTime: 1,
					dir: DIR.DIR_FORWARDS,
					blockSize: 1,
					intensity: 0,
					parts: [
						...interpolate(
							new Color(255, 0, 0),
							new Color(0, 255, 0),
							5,
							{ end: false }
						),
						...interpolate(
							new Color(0, 255, 0),
							new Color(0, 0, 255),
							5,
							{ end: false }
						),
						...interpolate(
							new Color(0, 0, 255),
							new Color(255, 0, 0),
							5,
							{ end: false }
						)
					]
				}
			},
			rainbow2: {
				type: 'rainbow',
				data: {
					updateTime: 1,
					blockSize: 2
				}
			},
			reddot: {
				type: 'dot',
				data: {
					backgroundBlue: 0,
					backgroundGreen: 0,
					backgroundRed: 0,
					intensity: getIntensityPercentage(100),
					dots: [
						{
							r: 255,
							g: 0,
							b: 0,
							dir: DIR.DIR_FORWARDS,
							dotPos: 0,
							size: 5,
							speed: 1
						}
					]
				}
			},
			multidot: {
				type: 'dot',
				data: {
					backgroundBlue: 0,
					backgroundGreen: 0,
					backgroundRed: 0,
					intensity: getIntensityPercentage(100),
					dots: [
						{
							r: 255,
							g: 0,
							b: 0,
							dir: DIR.DIR_FORWARDS,
							dotPos: 0,
							size: 5,
							speed: 1
						},
						{
							r: 0,
							g: 255,
							b: 0,
							dir: DIR.DIR_FORWARDS,
							dotPos: 12,
							size: 5,
							speed: 1
						},
						{
							r: 0,
							g: 0,
							b: 255,
							dir: DIR.DIR_FORWARDS,
							dotPos: 24,
							size: 5,
							speed: 1
						},
						{
							r: 255,
							g: 0,
							b: 255,
							dir: DIR.DIR_FORWARDS,
							dotPos: 36,
							size: 5,
							speed: 1
						},
						{
							r: 255,
							g: 255,
							b: 0,
							dir: DIR.DIR_FORWARDS,
							dotPos: 48,
							size: 5,
							speed: 1
						},
						{
							r: 0,
							g: 255,
							b: 255,
							dir: DIR.DIR_FORWARDS,
							dotPos: 60,
							size: 5,
							speed: 1
						}
					]
				}
			},
			reddotbluebg: {
				type: 'dot',
				data: {
					backgroundBlue: 255,
					backgroundGreen: 0,
					backgroundRed: 0,
					intensity: getIntensityPercentage(100),
					dots: [
						{
							r: 255,
							g: 0,
							b: 0,
							dir: DIR.DIR_FORWARDS,
							dotPos: 0,
							size: 5,
							speed: 1
						}
					]
				}
			},
			split: {
				type: 'split',
				data: {
					intensity: getIntensityPercentage(100),
					updateTime: 100,
					dir: DIR.DIR_FORWARDS,
					parts: [
						new Color(0, 0, 255),
						new Color(255, 0, 0),
						new Color(255, 0, 255),
						new Color(0, 255, 0)
					]
				}
			},
			rgb: {
				type: 'pattern',
				data: {
					blockSize: 1,
					intensity: getIntensityPercentage(100),
					dir: DIR.DIR_FORWARDS,
					updateTime: 1,
					parts: [
						new Color(255, 0, 0),
						new Color(0, 255, 0),
						new Color(0, 0, 255)
					]
				}
			},
			quickstrobe: {
				type: 'flash',
				data: {
					mode: 'strobe',
					blockSize: 2,
					intensity: getIntensityPercentage(100),
					updateTime: 1
				}
			},
			strobe: {
				type: 'flash',
				data: {
					mode: 'strobe',
					blockSize: 7,
					intensity: getIntensityPercentage(100),
					updateTime: 60
				}
			},
			slowstrobe: {
				type: 'flash',
				data: {
					mode: 'strobe',
					blockSize: 3,
					intensity: getIntensityPercentage(100),
					updateTime: 500
				}
			},
			brightstrobe: {
				type: 'flash',
				data: {
					mode: 'strobe',
					blockSize: 3,
					intensity: getIntensityPercentage(100),
					updateTime: 1000
				}
			},
			epileptisch: {
				type: 'flash',
				data: {
					mode: 'fade',
					blockSize: 1,
					intensity: getIntensityPercentage(100),
					updateTime: 10,
					colors: [
						new Color(255, 0, 0),
						new Color(0, 0, 255),
						new Color(0, 255, 0)
					]
				}
			},
			quickfade: {
				type: 'flash',
				data: {
					mode: 'fade',
					blockSize: 1,
					intensity: getIntensityPercentage(100),
					updateTime: 100,
					colors: [
						new Color(255, 0, 0),
						new Color(0, 0, 255),
						new Color(0, 255, 0)
					]
				}
			},
			slowfade: {
				type: 'flash',
				data: {
					mode: 'fade',
					blockSize: 1,
					intensity: getIntensityPercentage(100),
					updateTime: 2500,
					colors: [
						new Color(255, 0, 0),
						new Color(0, 0, 255),
						new Color(0, 255, 0)
					]
				}
			},
			desk: {
				type: 'split',
				data: {
					intensity: 100,
					updateTime: 0,
					dir: DIR.DIR_FORWARDS,
					parts: [
						new Color(0, 0, 0),
						new Color(0, 0, 0),
						new Color(0, 0, 0),
						new Color(255, 255, 255),
						new Color(255, 255, 255),
						new Color(255, 255, 255),
						new Color(255, 255, 255),
						new Color(0, 0, 0),
						new Color(0, 0, 0)
					]
				}
			}
		};
	}

	export namespace API {
		export const HEX_REGEX = /#([a-fA-F\d]{2})([a-fA-F\d]{2})([a-fA-F\d]{2})/;
		export function hexToRGB(hex: string) {
			const match = HEX_REGEX.exec(hex)!;

			const [, r, g, b] = match;
			return new Color(parseInt(r, 16), parseInt(g, 16), parseInt(b, 16));
		}

		function singleNumToHex(num: number) {
			if (num < 10) {
				return num + '';
			}
			return String.fromCharCode(97 + (num - 10));
		}

		export function toHex(num: number) {
			return (
				singleNumToHex(Math.floor(num / 16)) + singleNumToHex(num % 16)
			);
		}

		export function rgbToHex(red: number, green: number, blue: number) {
			return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
		}

		export function colorToHex(color: Color) {
			return rgbToHex(color.r, color.g, color.b);
		}

		export class Handler {
			@errorHandle
			@requireParams('color')
			@auth
			public static async setColor(
				res: ResponseLike,
				{
					color,
					intensity
				}: {
					color: string;
					intensity?: number;
					auth?: string;
				}
			) {
				color = color.toLowerCase().trim();
				if (!(color in colorList)) {
					attachMessage(res, `Unknown color "${color}"`);
					res.status(400).end();
					return false;
				}
				const hexColor = colorList[color as keyof typeof colorList];
				const { r, g, b } = hexToRGB(hexColor);

				attachMessage(
					attachMessage(
						attachMessage(res, `rgb(${r}, ${g}, ${b})`),
						chalk.bgHex(hexColor)('   ')
					),
					`Updated ${Clients.clients!.length} clients`
				);

				await Promise.all(
					Clients.clients!.map(async client => {
						return Promise.all([
							client.setColorWithBrightness(
								r,
								g,
								b,
								100,
								intensity
							),
							client.turnOn()
						]);
					})
				);

				res.status(200).end();
				return true;
			}

			@errorHandle
			@requireParams('red', 'green', 'blue')
			@authAll
			public static async setRGB(
				res: ResponseLike,
				{
					red,
					green,
					blue,
					intensity
				}: {
					red: string;
					green: string;
					blue: string;
					auth?: string;
					intensity?: number;
				}
			) {
				const redNum = Math.min(255, Math.max(0, parseInt(red, 10)));
				const greenNum = Math.min(
					255,
					Math.max(0, parseInt(green, 10))
				);
				const blueNum = Math.min(255, Math.max(0, parseInt(blue, 10)));
				attachMessage(
					attachMessage(
						attachMessage(res, `rgb(${red}, ${green}, ${blue})`),
						chalk.bgHex(rgbToHex(redNum, greenNum, blueNum))('   ')
					),
					`Updated ${Clients.clients!.length} clients`
				);

				await Promise.all(
					Clients.clients!.map(async client => {
						return Promise.all([
							client.setColorWithBrightness(
								redNum,
								greenNum,
								blueNum,
								100,
								intensity
							),
							client.turnOn()
						]);
					})
				);

				res.status(200).end();
			}

			@errorHandle
			@requireParams('power')
			@authAll
			public static async setPower(
				res: ResponseLike,
				{
					power
				}: {
					power: string;
					auth?: string;
				}
			) {
				attachMessage(
					attachMessage(res, `Turned ${power}`),
					`Updated ${Clients.clients!.length} clients`
				);
				await Promise.all(
					Clients.clients!.map(c =>
						power === 'on' ? c.turnOn() : c.turnOff()
					)
				);
				res.status(200).end();
			}

			static overrideTransition(
				pattern: CustomMode,
				transition: 'fade' | 'jump' | 'strobe'
			) {
				return new CustomMode()
					.addColorList(
						pattern.colors.map(({ red, green, blue }) => {
							return [red, green, blue] as [
								number,
								number,
								number
							];
						})
					)
					.setTransitionType(transition);
			}

			@errorHandle
			@requireParams('pattern')
			@authAll
			public static async runPattern(
				res: ResponseLike,
				{
					pattern: patternName,
					speed,
					transition
				}: {
					pattern: CustomPattern;
					speed?: number;
					transition?: string;
					auth?: string;
				}
			) {
				if (!patterns.hasOwnProperty(patternName)) {
					attachMessage(res, `Pattern ${patternName} does not exist`);
					res.status(400).write('Unknown pattern');
					res.end();
					return false;
				}

				let { pattern, defaultSpeed, arduinoOnly = false } = patterns[
					patternName as CustomPattern
				];
				if (transition) {
					if (['fade', 'jump', 'strobe'].indexOf(transition) === -1) {
						attachMessage(
							res,
							`Invalid transition mode ${transition}`
						);
						res.status(400).write('Invalid transiton mode');
						res.end();
						return false;
					}

					pattern = this.overrideTransition(
						pattern,
						transition as TransitionTypes
					);
				}

				const usedClients = arduinoOnly
					? Clients.arduinoClients
					: Clients.clients;
				attachMessage(
					attachMessage(res, `Running pattern ${patternName}`),
					`Updated ${usedClients!.length} clients`
				);
				try {
					await Promise.all(
						usedClients!.map(c => {
							return Promise.all([
								c.setCustomPattern(
									pattern,
									speed || defaultSpeed
								),
								c.turnOn()
							]);
						})
					);
					res.status(200).end();
					return true;
				} catch (e) {
					res.status(400).write('Failed to run pattern');
					res.end();
					return false;
				}
			}

			@errorHandle
			@requireParams('effect')
			@auth
			public static async runEffect(
				res: ResponseLike,
				body: {
					effect: ArduinoAPI.Effects;
					auth?: string;
				} & {
					[key: string]: any;
				}
			) {
				const { effect: effectName } = body;
				if (!ArduinoAPI.arduinoEffects.hasOwnProperty(effectName)) {
					attachMessage(res, `Effect ${effectName} does not exist`);
					res.status(400).write('Unknown effect');
					res.end();
					return false;
				}

				const effect = ArduinoAPI.arduinoEffects[effectName];

				try {
					const strings = await Promise.all(
						Clients.arduinoClients.map(async c => {
							return c.board.runConfig(
								effect,
								body as ArduinoAPI.JoinedConfigs
							);
						})
					);
					attachMessage(
						attachMessage(
							attachMessage(res, `Running effect ${effectName}`),
							`Updated ${Clients.arduinoClients.length} clients`
						),
						`Sent string "${strings[0]}"`
					);
					res.status(200).end();
					return true;
				} catch (e) {
					console.log(e);
					attachMessage(
						attachMessage(
							res,
							`Failed to run effect ${effectName}`
						),
						`Updated ${Clients.arduinoClients.length} clients`
					);
					res.status(400).write('Failed to run effect');
					res.end();
					return false;
				}
			}

			@errorHandle
			@requireParams('config')
			@auth
			public static async runConfig(
				res: ResponseLike,
				{
					config
				}: {
					config: ArduinoAPI.ArduinoConfig;
					auth?: string;
				}
			) {
				attachMessage(
					attachMessage(
						res,
						`Running config ${JSON.stringify(config)}`
					),
					`Updated ${Clients.arduinoClients.length} clients`
				);
				try {
					const strings = await Promise.all(
						Clients.arduinoClients.map(async c => {
							return c.board.runConfig(config);
						})
					);
					attachMessage(
						attachMessage(
							attachMessage(
								res,
								`Running config ${JSON.stringify(config)}`
							),
							`Updated ${Clients.arduinoClients.length} clients`
						),
						`Sent string "${strings[0]}"`
					);
					res.status(200).end();
					return true;
				} catch (e) {
					res.status(400).write('Failed to run config');
					res.end();
					return false;
				}
			}

			@errorHandle
			@auth
			public static async refresh(res: ResponseLike) {
				await Scan.scanRGBControllers();
				res.status(200);
				res.end();
			}
		}
	}

	export namespace External {
		type ExternalRequest = (
			| ({
					type: 'color';
					intensity: number;
			  } & (
					| {
							color: string;
					  }
					| {
							r: string;
							g: string;
							b: string;
					  }
			  ))
			| {
					type: 'power';
					state: 'on' | 'off';
			  }
			| {
					type: 'pattern';
					name: string;
					speed?: number;
					transition?: 'fade' | 'jump' | 'strobe';
			  }
			| {
					type: 'effect';
					name: ArduinoAPI.Effects;
					extra: ArduinoAPI.JoinedConfigs;
			  }
			| {
					type: 'config';
					config: ArduinoAPI.ArduinoConfig;
			  }
		) & {
			logObj: any;
			resolver: (value?: any) => void;
		};

		export class Handler {
			private static _requests: ExternalRequest[] = [];

			private static _ready: boolean = false;
			static async init() {
				this._ready = true;
				for (const req of this._requests) {
					await this._handleRequest(req);
				}
			}

			constructor(private _logObj: any) {}

			private static async _handleRequest(request: ExternalRequest) {
				const { logObj, resolver } = request;
				const resDummy = new ResDummy();
				let value = undefined;
				if (request.type === 'color') {
					if ('color' in request) {
						value = await API.Handler.setColor(resDummy, {
							color: request.color,
							intensity: request.intensity,
							auth: await Auth.Secret.getKey()
						});
					} else {
						const { r, g, b } = request;
						await API.Handler.setRGB(resDummy, {
							red: r,
							green: g,
							blue: b,
							intensity: request.intensity,
							auth: await Auth.Secret.getKey()
						});
					}
				} else if (request.type == 'power') {
					await API.Handler.setPower(resDummy, {
						power: request.state,
						auth: await Auth.Secret.getKey()
					});
				} else if (request.type === 'effect') {
					await API.Handler.runEffect(resDummy, {
						effect: request.name,
						auth: await Auth.Secret.getKey(),
						...request.extra
					});
				} else if (request.type === 'config') {
					await API.Handler.runConfig(resDummy, {
						config: request.config,
						auth: await Auth.Secret.getKey()
					});
				} else {
					const { name, speed, transition } = request;
					value = await API.Handler.runPattern(resDummy, {
						pattern: name as any,
						speed,
						transition,
						auth: await Auth.Secret.getKey()
					});
				}
				resDummy.transferTo(logObj);
				resolver(value);
			}

			async color(color: string, intensity: number = 0) {
				return new Promise<boolean>(resolve => {
					const req: ExternalRequest = {
						type: 'color',
						color: color,
						intensity,
						logObj: this._logObj,
						resolver: resolve
					};
					if (Handler._ready) {
						Handler._handleRequest(req);
					} else {
						Handler._requests.push(req);
					}
				});
			}

			async rgb(
				red: string,
				green: string,
				blue: string,
				intensity: number = 0
			) {
				return new Promise(resolve => {
					const req: ExternalRequest = {
						type: 'color',
						r: red,
						g: green,
						b: blue,
						intensity,
						logObj: this._logObj,
						resolver: resolve
					};
					if (Handler._ready) {
						Handler._handleRequest(req);
					} else {
						Handler._requests.push(req);
					}
				});
			}

			async power(state: 'on' | 'off') {
				return new Promise(resolve => {
					const req: ExternalRequest = {
						type: 'power',
						state: state,
						logObj: this._logObj,
						resolver: resolve
					};
					if (Handler._ready) {
						Handler._handleRequest(req);
					} else {
						Handler._requests.push(req);
					}
				});
			}

			async pattern(
				name: string,
				speed?: number,
				transition?: 'fade' | 'jump' | 'strobe'
			) {
				return new Promise(resolve => {
					const req: ExternalRequest = {
						type: 'pattern',
						name,
						speed,
						transition,
						logObj: this._logObj,
						resolver: resolve
					};
					if (Handler._ready) {
						Handler._handleRequest(req);
					} else {
						Handler._requests.push(req);
					}
				});
			}

			async effect(
				name: ArduinoAPI.Effects,
				extra: ArduinoAPI.JoinedConfigs = {}
			) {
				return new Promise(resolve => {
					const req: ExternalRequest = {
						type: 'effect',
						name,
						extra,
						logObj: this._logObj,
						resolver: resolve
					};
					if (Handler._ready) {
						Handler._handleRequest(req);
					} else {
						Handler._requests.push(req);
					}
				});
			}

			async runConfig(config: ArduinoAPI.ArduinoConfig) {
				return new Promise(resolve => {
					const req: ExternalRequest = {
						type: 'config',
						config,
						logObj: this._logObj,
						resolver: resolve
					};
					if (Handler._ready) {
						Handler._handleRequest(req);
					} else {
						Handler._requests.push(req);
					}
				});
			}

			static x() {}
		}
	}

	export namespace Bot {
		export interface JSON {
			lastConfig:
				| (ArduinoAPI.ArduinoConfig & {
						data?: ArduinoAPI.JoinedConfigs;
				  })
				| null;
		}

		export class Bot extends BotState.Base {
			static readonly commands = {
				'/rgboff': 'Turn off RGB',
				'/rgbon': 'Turn on RGB',
				'/arduinooff': 'Turn off arduino lights',
				'/magicoff': 'Turn off magic-home lights',
				'/color': 'Set color to given value',
				'/pattern': 'Start given pattern',
				'/effect': 'Start given effect',
				'/intensity': 'Set intensity to given value',
				'/blocksize': 'Set block size to given value',
				'/red': 'Set red to given value',
				'/green': 'Set green to given value',
				'/blue': 'Set blue to given value',
				'/background': 'Set background to given color',
				'/dot': 'Set dot to given color',
				'/updatetime': 'Set update-time to given value',
				'/dir': 'Set dir to given value',
				'/mode': 'Set mode to given value',
				'/effects': 'List effects',
				'/refresh': 'Refresh LEDs',
				'/help_rgb': 'Print help comands for RGB',
				'/restart': 'Restart the server'
			};

			static readonly botName = 'RGB';

			static colorTextToColor(text: string) {
				if (API.HEX_REGEX.test(text)) {
					return API.hexToRGB(text);
				}
				if (text in colorList) {
					return API.hexToRGB(
						colorList[text as keyof typeof colorList]
					);
				}
				return undefined;
			}

			static parseDir(dir: string) {
				if (dir === 'backwards' || dir === 'back' || dir === '0') {
					return ArduinoAPI.DIR.DIR_BACKWARDS;
				}
				return ArduinoAPI.DIR.DIR_FORWARDS;
			}

			static readonly matches = Bot.createMatchMaker(
				({ matchMaker: mm }) => {
					function rgbOff(
						state: _Bot.Message.StateKeeping.ChatState
					) {
						state.rgb.lastConfig = {
							type: 'off'
						};
					}
					function rgbOn(state: _Bot.Message.StateKeeping.ChatState) {
						state.rgb.lastConfig = {
							type: 'solid',
							data: new Color(100)
						};
					}
					mm('/rgbon', async ({ state, logObj }) => {
						rgbOn(state);
						await new External.Handler(logObj).power('on');
						return `Turned it on`;
					});
					mm('/rgboff', async ({ state, logObj }) => {
						rgbOff(state);
						await new External.Handler(logObj).power('off');
						return `Turned it off`;
					});
					mm(
						/turn (on|off) (rgb|led)/,
						async ({ logObj, match, state }) => {
							const targetState = match[1];
							if (targetState === 'on') {
								rgbOn(state);
							} else {
								rgbOff(state);
							}
							await new External.Handler(logObj).power(
								targetState as 'on' | 'off'
							);
							return `Turned it ${targetState}`;
						}
					);
					mm(
						'/arduinooff',
						/turn (on|off) (ceiling|arduino|duino)/,
						async ({ logObj, match, state }) => {
							const targetState =
								match.length === 0 ? 'off' : match[1];
							if (targetState === 'on') {
								state.rgb.lastConfig = {
									type: 'solid',
									data: new Color(100)
								};
							} else {
								state.rgb.lastConfig = {
									type: 'off'
								};
							}
							attachMessage(
								logObj,
								`Turned ${targetState} ${Clients.arduinoClients.length} arduino clients`
							);
							return `Turned ${targetState} ${Clients.arduinoClients.length} arduino clients`;
						}
					);
					mm(
						'/magicoff',
						/turn (on|off) (magic(-| )home)/,
						async ({ logObj, match }) => {
							const targetState =
								match.length === 0 ? 'off' : match[1];

							await Promise.all(
								Clients.magicHomeClients.map(
									c =>
										new Promise(resolve => {
											if (targetState === 'on') {
												c.turnOff(resolve);
											} else {
												c.turnOff(resolve);
											}
										})
								)
							);
							attachMessage(
								logObj,
								`Turned ${targetState} ${Clients.magicHomeClients.length} magichome clients`
							);
							return `Turned ${targetState} ${Clients.magicHomeClients.length} magichome clients`;
						}
					);
					mm(
						/\/color (?:(?:(\d+) (\d+) (\d+))|([^ ]+))/,
						/set (?:rgb|led(?:s)?|it|them|color) to (?:(?:(\d+) (\d+) (\d+))|([^ ]+))(\s+with intensity (\d+))?/,
						async ({ logObj, match, state }) => {
							const colorR = match[1];
							const colorG = match[2];
							const colorB = match[3];
							const colorStr = match[4];
							const intensity = match[6];
							const resolvedColor = (() => {
								if (colorStr) {
									return Bot.colorTextToColor(colorStr);
								}
								if (colorR && colorG && colorB) {
									return new Color(
										parseInt(colorR, 10),
										parseInt(colorG, 10),
										parseInt(colorB, 10)
									);
								}
								return undefined;
							})();
							if (resolvedColor) {
								state.rgb.lastConfig = {
									type: 'solid',
									data: new Color(
										resolvedColor.r,
										resolvedColor.g,
										resolvedColor.b
									)
								};
							} else {
								state.rgb.lastConfig = null;
							}
							if (resolvedColor) {
								await new External.Handler(logObj).rgb(
									resolvedColor.r + '',
									resolvedColor.g + '',
									resolvedColor.b + '',
									intensity?.length
										? parseInt(intensity, 10)
										: 0
								);
								return `Set color to ${JSON.stringify(
									resolvedColor
								)}`;
							} else {
								return 'Failed to set color (invalid color)';
							}
						}
					);
					mm(
						/\/pattern ([^ ]+)/,
						/(?:start|launch) pattern ([^ ]+)(\s+with speed ([^ ]+))?(\s*and\s*)?(with transition ([^ ]+))?(\s*and\s*)?(\s*with speed ([^ ]+))?/,
						async ({ logObj, match, state }) => {
							const [
								,
								pattern,
								,
								speed1,
								,
								,
								transition,
								,
								,
								speed2
							] = match;
							const speed = speed1 || speed2;

							state.rgb.lastConfig = null;

							if (
								await new External.Handler(logObj).pattern(
									pattern,
									parseInt(speed, 10) || undefined,
									(transition as any) || undefined
								)
							) {
								return `Started pattern ${pattern}`;
							} else {
								return 'Failed to start pattern';
							}
						}
					);
					mm(
						/\/effect ([^ ]+)/,
						/(?:(?:start effect)|(?:launch effect)|(?:run effect)|(?:set effect to)) ([^ ]+)(\s+with intensity ([^ ]+))?(\s*and\s*)?(\s*with background (((\d+) (\d+) (\d+))|([^ ]+)))?(\s*and\s*)?(\s*with update(-| )?time ([^ ]+))?(\s*and\s*)?(\s*with dir(ection)? ([^ ]+))?(\s*and\s*)?(\s*with (?:(?:block(-| )?size)|per(-| )?strobe) ([^ ]+))?(\s*and\s*)?(\s*with mode ([^ ]+))?(\s*and\s*)?(\s*with color (((\d+) (\d+) (\d+))|([^ ]+)))?/,
						async ({ logObj, match, state }) => {
							const effect = match[1] as ArduinoAPI.Effects;
							const intensity = match[3];
							const bgR = match[8];
							const bgG = match[9];
							const bgB = match[10];
							const bg = match[11];
							const updateTime = match[15];
							const dir = match[19];
							const blockSize = match[23];
							const mode = match[26];
							const colorR = match[31];
							const colorG = match[32];
							const colorB = match[33];
							const colorStr = match[34];

							const background = (() => {
								if (bg) {
									return Bot.colorTextToColor(bg);
								}
								if (bgR && bgG && bgB) {
									return new Color(
										parseInt(bgR, 10),
										parseInt(bgG, 10),
										parseInt(bgB, 10)
									);
								}
								return undefined;
							})();
							const color = (() => {
								if (colorStr) {
									return Bot.colorTextToColor(colorStr);
								}
								if (colorR && colorG && colorB) {
									return new Color(
										parseInt(colorR, 10),
										parseInt(colorG, 10),
										parseInt(colorB, 10)
									);
								}
								return undefined;
							})();
							const config = {
								intensity:
									intensity !== undefined
										? parseInt(intensity, 10)
										: undefined,
								backgroundRed: background
									? background.r
									: undefined,
								backgroundGreen: background
									? background.g
									: undefined,
								backgroundBlue: background
									? background.b
									: undefined,
								updateTime: updateTime
									? parseInt(updateTime, 10)
									: undefined,
								dir: dir ? Bot.parseDir(dir) : undefined,
								blockSize: blockSize
									? parseInt(blockSize, 10)
									: undefined,
								mode: mode as TransitionTypes,
								colors: color ? [color] : undefined
							};

							if (effect in ArduinoAPI.arduinoEffects) {
								state.rgb.lastConfig = {
									...ArduinoAPI.arduinoEffects[effect]
								};
								if ('data' in state.rgb.lastConfig) {
									state.rgb.lastConfig.data = Bot.mergeObj(
										state.rgb.lastConfig.data,
										Bot.unsetUndefined(config)
									);
								}
							} else {
								state.rgb.lastConfig = null;
								return `Effect "${effect}" does not exist`;
							}

							await new External.Handler(logObj).effect(
								effect,
								config
							);
							return `Started effect "${effect}" with config ${JSON.stringify(
								Bot.mergeObj(
									ArduinoAPI.arduinoEffects[effect],
									Bot.unsetUndefined(config)
								)
							)}`;
						}
					);
					mm(
						/(create) effect ([^ ]+)(\s+with intensity ([^ ]+))?(\s*and\s*)?(\s*with background (((\d+) (\d+) (\d+))|([^ ]+)))?(\s*and\s*)?(\s*with update(-| )?time ([^ ]+))?(\s*and\s*)?(\s*with dir(ection)? ([^ ]+))?(\s*and\s*)?(\s*with (?:(?:block(-| )?size)|per(-| )?strobe) ([^ ]+))?(\s*and\s*)?(\s*with mode ([^ ]+))?(\s*and\s*)?(\s*with color (((\d+) (\d+) (\d+))|([^ ]+)))?/,
						async ({ logObj, match, state }) => {
							const type = match[2] as ArduinoAPI.ArduinoConfig['type'];
							const intensity = match[4];
							const bgR = match[9];
							const bgG = match[10];
							const bgB = match[11];
							const bg = match[12];
							const updateTime = match[16];
							const dir = match[20];
							const blockSize = match[24];
							const mode = match[27];
							const colorR = match[32];
							const colorG = match[33];
							const colorB = match[34];
							const colorStr = match[35];

							const background = (() => {
								if (bg) {
									return Bot.colorTextToColor(bg);
								}
								if (bgR && bgG && bgB) {
									return new Color(
										parseInt(bgR, 10),
										parseInt(bgG, 10),
										parseInt(bgB, 10)
									);
								}
								return undefined;
							})();
							const color = (() => {
								if (colorStr) {
									return Bot.colorTextToColor(colorStr);
								}
								if (colorR && colorG && colorB) {
									return new Color(
										parseInt(colorR, 10),
										parseInt(colorG, 10),
										parseInt(colorB, 10)
									);
								}
								return undefined;
							})();
							const config = {
								intensity:
									intensity !== undefined
										? parseInt(intensity, 10)
										: undefined,
								backgroundRed: background
									? background.r
									: undefined,
								backgroundGreen: background
									? background.g
									: undefined,
								backgroundBlue: background
									? background.b
									: undefined,
								updateTime: updateTime
									? parseInt(updateTime, 10)
									: undefined,
								dir: dir ? Bot.parseDir(dir) : undefined,
								blockSize: blockSize
									? parseInt(blockSize, 10)
									: undefined,
								mode: mode,
								colors: color ? [color] : undefined
							};

							state.rgb.lastConfig = {
								type,
								data: { ...config }
							} as any;

							if (
								await new External.Handler(logObj).runConfig({
									type,
									data: config as any
								})
							) {
								return `Started effect of type ${type} with config ${JSON.stringify(
									config
								)}`;
							} else {
								return 'Failed to start effect';
							}
						}
					);
					mm(
						/\/intensity ([^ ]+)/,
						/(?:change|set) intensity to ([^ ]+)/,
						async ({ logObj, state, match }) => {
							if (state.rgb.lastConfig === null) {
								attachMessage(logObj, 'No lastConfig for RGB');
								return 'I don\'t know what to edit';
							}
							state.rgb.lastConfig.data =
								state.rgb.lastConfig.data || {};
							state.rgb.lastConfig.data.intensity = parseInt(
								match[1],
								10
							);
							const msg = `Changed config to ${JSON.stringify(
								state.rgb.lastConfig
							)} (intensity->${
								state.rgb.lastConfig.data.intensity
							})`;
							attachMessage(logObj, msg);
							await new External.Handler(logObj).runConfig(
								state.rgb.lastConfig
							);
							return msg;
						}
					);
					mm(
						/\/blocksize ([^ ]+)/,
						/(?:change|set) (?:(?:block(?:-| )?size)|per(?:-| )?strobe) to ([^ ]+)/,
						async ({ logObj, state, match }) => {
							if (state.rgb.lastConfig === null) {
								attachMessage(logObj, 'No lastConfig for RGB');
								return 'I don\'t know what to edit';
							}
							state.rgb.lastConfig.data =
								state.rgb.lastConfig.data || {};
							state.rgb.lastConfig.data.blockSize = parseInt(
								match[1],
								10
							);
							const msg = `Changed config to ${JSON.stringify(
								state.rgb.lastConfig
							)} (blockSize->${
								state.rgb.lastConfig.data.blockSize
							})`;
							attachMessage(logObj, msg);
							await new External.Handler(logObj).runConfig(
								state.rgb.lastConfig
							);
							return msg;
						}
					);
					mm(
						/\/red (\d+)/,
						/(?:change|set) r(?:ed)? to (\d+)/,
						async ({ logObj, state, match }) => {
							if (state.rgb.lastConfig === null) {
								attachMessage(logObj, 'No lastConfig for RGB');
								return 'I don\'t know what to edit';
							}
							state.rgb.lastConfig.data =
								state.rgb.lastConfig.data || {};
							state.rgb.lastConfig.data.r = parseInt(
								match[1],
								10
							);
							const msg = `Changed config to ${JSON.stringify(
								state.rgb.lastConfig
							)} (r->${state.rgb.lastConfig.data.r})`;
							attachMessage(logObj, msg);
							await new External.Handler(logObj).runConfig(
								state.rgb.lastConfig
							);
							return msg;
						}
					);
					mm(
						/\/green (\d+)/,
						/(?:change|set) g(?:reen)? to (\d+)/,
						async ({ logObj, state, match }) => {
							if (state.rgb.lastConfig === null) {
								attachMessage(logObj, 'No lastConfig for RGB');
								return 'I don\'t know what to edit';
							}
							state.rgb.lastConfig.data =
								state.rgb.lastConfig.data || {};
							state.rgb.lastConfig.data.g = parseInt(
								match[1],
								10
							);
							const msg = `Changed config to ${JSON.stringify(
								state.rgb.lastConfig
							)} (g->${state.rgb.lastConfig.data.g})`;
							attachMessage(logObj, msg);
							await new External.Handler(logObj).runConfig(
								state.rgb.lastConfig
							);
							return msg;
						}
					);
					mm(
						/\/blue (\d+)/,
						/(?:change|set) r(?:blue)? to (\d+)/,
						async ({ logObj, state, match }) => {
							if (state.rgb.lastConfig === null) {
								attachMessage(logObj, 'No lastConfig for RGB');
								return 'I don\'t know what to edit';
							}
							state.rgb.lastConfig.data =
								state.rgb.lastConfig.data || {};
							state.rgb.lastConfig.data.b = parseInt(
								match[1],
								10
							);
							const msg = `Changed config to ${JSON.stringify(
								state.rgb.lastConfig
							)} (b->${state.rgb.lastConfig.data.b})`;
							attachMessage(logObj, msg);
							await new External.Handler(logObj).runConfig(
								state.rgb.lastConfig
							);
							return msg;
						}
					);
					mm(
						/(?:change|set) (color|part)( \d+)? to (((\d+) (\d+) (\d+))|([^ ]+))/,
						async ({ logObj, state, match }) => {
							if (state.rgb.lastConfig === null) {
								attachMessage(logObj, 'No lastConfig for RGB');
								return 'I don\'t know what to edit';
							}

							const colorIndex = match[2]
								? parseInt(match[2], 10)
								: 0;
							const colorR = match[5];
							const colorG = match[6];
							const colorB = match[7];
							const colorStr = match[8];
							const color = (() => {
								if (colorStr) {
									return Bot.colorTextToColor(colorStr);
								}
								if (colorR && colorG && colorB) {
									return new Color(
										parseInt(colorR, 10),
										parseInt(colorG, 10),
										parseInt(colorB, 10)
									);
								}
								return undefined;
							})();
							if (!color) {
								attachMessage(logObj, 'Unknown color');
								return 'Unknown color';
							}

							state.rgb.lastConfig.data =
								state.rgb.lastConfig.data || {};
							state.rgb.lastConfig.data.r = color.r;
							state.rgb.lastConfig.data.g = color.g;
							state.rgb.lastConfig.data.b = color.b;
							state.rgb.lastConfig.data.colors =
								state.rgb.lastConfig.data.colors || [];
							state.rgb.lastConfig.data.parts =
								state.rgb.lastConfig.data.parts || [];
							state.rgb.lastConfig.data.colors[colorIndex] = {
								...color
							};
							state.rgb.lastConfig.data.parts[colorIndex] = {
								...color
							};
							const msg = `Changed config to ${JSON.stringify(
								state.rgb.lastConfig
							)} (color->${JSON.stringify(color)})`;
							attachMessage(logObj, msg);
							await new External.Handler(logObj).runConfig(
								state.rgb.lastConfig
							);
							return msg;
						}
					);
					mm(
						/\/background (?:(?:(\d+) (\d+) (\d+))|([^ ]+))/,
						/(?:change|set) background(?:-| )?(?:color)? to (?:(?:(\d+) (\d+) (\d+))|([^ ]+))/,
						async ({ logObj, state, match }) => {
							if (state.rgb.lastConfig === null) {
								attachMessage(logObj, 'No lastConfig for RGB');
								return 'I don\'t know what to edit';
							}

							const colorR = match[1];
							const colorG = match[2];
							const colorB = match[3];
							const colorStr = match[4];
							const color = (() => {
								if (colorStr) {
									return Bot.colorTextToColor(colorStr);
								}
								if (colorR && colorG && colorB) {
									return new Color(
										parseInt(colorR, 10),
										parseInt(colorG, 10),
										parseInt(colorB, 10)
									);
								}
								return undefined;
							})();
							if (!color) {
								attachMessage(logObj, 'Unknown color');
								return 'Unknown color';
							}

							state.rgb.lastConfig.data =
								state.rgb.lastConfig.data || {};
							state.rgb.lastConfig.data.backgroundRed = color.r;
							state.rgb.lastConfig.data.backgroundGreen = color.g;
							state.rgb.lastConfig.data.backgroundBlue = color.b;
							const msg = `Changed config to ${JSON.stringify(
								state.rgb.lastConfig
							)} (color->${JSON.stringify(color)})`;
							attachMessage(logObj, msg);
							await new External.Handler(logObj).runConfig(
								state.rgb.lastConfig
							);
							return msg;
						}
					);
					mm(
						/\/dot (?:(?:(\d+) (\d+) (\d+))|([^ ]+))/,
						/(?:change|set) dot (\d+)?('s)? ([^ ]+) to ([^ ]+)/,
						async ({ logObj, state, match }) => {
							if (state.rgb.lastConfig === null) {
								attachMessage(logObj, 'No lastConfig for RGB');
								return 'I don\'t know what to edit';
							}

							const dotIndex = parseInt(match[1], 10);
							const prop = match[3];
							const value =
								prop === 'dir'
									? Bot.parseDir(match[4])
									: parseInt(match[4], 10);

							state.rgb.lastConfig.data =
								state.rgb.lastConfig.data || {};
							state.rgb.lastConfig.data.dots =
								state.rgb.lastConfig.data.dots || [];
							(state.rgb.lastConfig.data.dots[dotIndex] as any)[
								prop
							] = value;
							const msg = `Changed config to ${JSON.stringify(
								state.rgb.lastConfig
							)} (dot[${dotIndex}].${prop}->${value})`;
							attachMessage(logObj, msg);
							await new External.Handler(logObj).runConfig(
								state.rgb.lastConfig
							);
							return msg;
						}
					);
					mm(
						/\/updatetime ([^ ]+)/,
						/(?:change|set) update(?:-| )?time to ([^ ]+)/,
						async ({ logObj, state, match }) => {
							if (state.rgb.lastConfig === null) {
								attachMessage(logObj, 'No lastConfig for RGB');
								return 'I don\'t know what to edit';
							}
							state.rgb.lastConfig.data =
								state.rgb.lastConfig.data || {};
							state.rgb.lastConfig.data.updateTime = parseInt(
								match[1],
								10
							);
							const msg = `Changed config to ${JSON.stringify(
								state.rgb.lastConfig
							)} (updateTime->${
								state.rgb.lastConfig.data.updateTime
							})`;
							attachMessage(logObj, msg);
							await new External.Handler(logObj).runConfig(
								state.rgb.lastConfig
							);
							return msg;
						}
					);
					mm(
						/\/dir ([^ ]+)/,
						/(?:change|set) dir to ([^ ]+)/,
						async ({ logObj, state, match }) => {
							if (state.rgb.lastConfig === null) {
								attachMessage(logObj, 'No lastConfig for RGB');
								return 'I don\'t know what to edit';
							}
							state.rgb.lastConfig.data =
								state.rgb.lastConfig.data || {};
							state.rgb.lastConfig.data.dir = Bot.parseDir(
								match[1]
							);
							const msg = `Changed config to ${JSON.stringify(
								state.rgb.lastConfig
							)} (dir->${state.rgb.lastConfig.data.dir})`;
							attachMessage(logObj, msg);
							await new External.Handler(logObj).runConfig(
								state.rgb.lastConfig
							);
							return msg;
						}
					);
					mm(
						/\/mode ([^ ]+)/,
						/(?:change|set) mode to ([^ ]+)/,
						async ({ logObj, state, match }) => {
							if (state.rgb.lastConfig === null) {
								attachMessage(logObj, 'No lastConfig for RGB');
								return 'I don\'t know what to edit';
							}
							state.rgb.lastConfig.data =
								state.rgb.lastConfig.data || {};
							state.rgb.lastConfig.data.mode = match[1] as TransitionTypes;
							const msg = `Changed config to ${JSON.stringify(
								state.rgb.lastConfig
							)} (mode->${state.rgb.lastConfig.data.mode})`;
							attachMessage(logObj, msg);
							await new External.Handler(logObj).runConfig(
								state.rgb.lastConfig
							);
							return msg;
						}
					);
					mm('/effects', /what effects are there(\?)?/, async () => {
						return `Effects are ${Bot.formatList(
							Object.keys(ArduinoAPI.arduinoEffects)
						)}`;
					});
					mm('/refresh', /refresh (rgb|led)/, async ({ logObj }) => {
						return `Found ${await Scan.scanRGBControllers(
							false,
							logObj
						)} RGB controllers`;
					});
					mm('/perf', /get perf(ormance)?/, async ({ logObj }) => {
						const perfs = await Promise.all(
							Clients.arduinoClients.map(client => {
								return new Promise<string>(resolve => {
									client.board.setListener((res: string) => {
										const [
											section,
											min,
											max,
											avg
										] = res.split(',');
										const str = `${section}: min: ${min}, max: ${max}, avg: ${avg}`;
										attachMessage(
											logObj,
											`${client.address}: ${str}`
										);
										resolve(str);
									});
									client.board.sendCommand('perf main');
									client.board.sendCommand('perf loop');
								});
							})
						);
						return perfs.join(',');
					});
					mm(
						'/help_rgb',
						/what commands are there for rgb/,
						async () => {
							return `Commands are:\n${Bot.matches.matches
								.map(match => {
									return `RegExps: ${match.regexps
										.map(r => r.source)
										.join(', ')}. Texts: ${match.texts.join(
										', '
									)}}`;
								})
								.join('\n')}`;
						}
					);
					mm(
						'/restart',
						/restart( yourself)?/,
						/reboot( yourself)?/,
						async () => {
							log(
								getTime(),
								chalk.red(`[self]`, 'Restarting self')
							);
							setTimeout(() => {
								restartSelf();
							}, 50);
							return 'Restarting...';
						}
					);
				}
			);

			constructor(json?: JSON) {
				super();
				if (json) {
					this.lastConfig = json.lastConfig;
				}
			}

			public lastConfig:
				| (ArduinoAPI.ArduinoConfig & {
						data?: ArduinoAPI.JoinedConfigs;
				  })
				| null = null;

			static async match(config: {
				logObj: any;
				text: string;
				message: _Bot.TelegramMessage;
				state: _Bot.Message.StateKeeping.ChatState;
			}): Promise<_Bot.Message.MatchResponse | undefined> {
				return await this.matchLines({
					...config,
					matchConfig: Bot.matches
				});
			}

			toJSON(): JSON {
				return {
					lastConfig: this.lastConfig
				};
			}
		}
	}

	export namespace WebPage {
		const patternPreviews = JSON.stringify(
			Object.keys(patterns).map(key => {
				const {
					pattern: { colors, transitionType },
					defaultSpeed
				} = patterns[key as CustomPattern];
				return {
					defaultSpeed,
					colors,
					transitionType,
					name: key
				};
			})
		);

		async function rgbHTML(randomNum: number) {
			return `<html style="background-color: rgb(70,70,70);">
				<head>
					<link rel="icon" href="/rgb/favicon.ico" type="image/x-icon" />
					<link rel="manifest" href="/rgb/static/manifest.json">
					<meta name="viewport" content="width=device-width, initial-scale=1">
					<title>RGB controller</title>
				</head>
				<body style="margin: 0">
					<rgb-controller key="${await Auth.Secret.getKey()}" patterns='${patternPreviews}'></rgb-controller>
					<script type="module" src="/rgb/rgb.bundle.js?n=${randomNum}"></script>
				</body>
			</html>`;
		}

		export class Handler {
			@errorHandle
			@authCookie
			@upgradeToHTTPS
			public static async index(
				res: ResponseLike,
				_req: express.Request,
				randomNum: number
			) {
				res.status(200);
				res.contentType('.html');
				res.write(await rgbHTML(randomNum));
				res.end();
			}
		}
	}

	export namespace Board {
		async function tryConnectToSerial() {
			return new Promise<{
				port: SerialPort;
				updateListener(listener: (line: string) => any): void;
				leds: number;
				name: string;
			} | null>(resolve => {
				const port = new SerialPort(LED_DEVICE_NAME, {
					baudRate: 115200
				});

				let err: boolean = false;
				port.on('error', e => {
					log(
						getTime(),
						chalk.red('Failed to connect to LED arduino', e)
					);
					resolve(null);
					err = true;
				});

				//@ts-ignore
				const parser = new ReadLine();
				//@ts-ignore
				port.pipe(parser);

				// Get LEDS
				setTimeout(() => {
					if (err) return;
					port.write('/ leds \\\n');
				}, 2500);

				let onData = async (line: string) => {
					const LED_NUM = parseInt(line, 10);

					log(
						getTime(),
						chalk.gray(`[${LED_DEVICE_NAME}]`),
						`Connected, ${LED_NUM} leds detected`
					);

					onData = (): any => {};
					resolve({
						port,
						updateListener: (listener: (line: string) => any) => {
							onData = listener;
						},
						leds: LED_NUM,
						name: LED_DEVICE_NAME
					});
				};

				parser.on('data', (line: string) => {
					onData(line);
				});
			});
		}

		export async function tryConnectRGBBoard(force: boolean = false) {
			if (force) {
				await Promise.all(Clients.arduinoBoards.map(b => b.destroy()));
			}

			const res = await tryConnectToSerial();
			if (res === null) return res;

			return new Board(res.port, res.updateListener, res.leds, res.name);
		}

		export class Board {
			private _dead: boolean = false;

			// @ts-ignore
			constructor(
				private _port: SerialPort,
				public setListener: (listener: (line: string) => any) => void,
				public leds: number,
				public name: string
			) {
				Clients.arduinoBoards.push(this);
			}

			public ping() {
				return new Promise<boolean>(resolve => {
					this.setListener((_line: string) => {
						resolve(true);
					});
					this.getLeds();
					setTimeout(() => {
						resolve(false);
					}, 1000);
				});
			}

			private _busy: number = -1;

			private async _waitForTurn() {
				return new Promise(resolve => {
					if (this._busy !== -1) {
						const interval = setInterval(() => {
							if (this._busy === -1) {
								this._busy = 0;
								clearInterval(interval);
								resolve();
							}
						}, 50);
					} else {
						resolve();
					}
				});
			}

			private _totalConnectTries = 0;
			private _restartAttempts: number = 0;

			public async write(data: string): Promise<string> {
				await this._waitForTurn();
				await new Promise(resolve => {
					let attempts: number = 0;
					this.setListener((line: string) => {
						if (line.indexOf('ack') !== -1) {
							resolve();
							clearInterval(interval);
						}
					});
					let pause: boolean = false;
					const interval = setInterval(() => {
						if (pause) return;
						this._port.write(data);
						attempts++;
						if (attempts >= SERIAL_MAX_ATTEMPTS) {
							if (process.argv.indexOf('--debug') > -1) {
								clearInterval(interval);
								return;
							}

							pause = true;
							this._port.close(async () => {
								const res = await tryConnectToSerial();
								if (!res || !res.port || !res.leds) {
									console.log('Failed to connect to serial');

									if (
										this._totalConnectTries > 10 &&
										this._restartAttempts === 0
									) {
										// Force restart this program
										await restartSelf();
										this._restartAttempts++;
										this._totalConnectTries++;
									}
									pause = false;
									return;
								}
								log(
									getTime(),
									chalk.red(`[rgb]`, 'Forcefully restarted')
								);
								this._port = res.port;
								this.leds = res.leds;
								this.setListener = res.updateListener;
								this.setListener((line: string) => {
									if (line.indexOf('ack') !== -1) {
										resolve();
										clearInterval(interval);
									}
								});
								attempts = 0;
								pause = false;
							});
						}
					}, SERIAL_MSG_INTERVAL);
				});
				this._busy = -1;
				return data;
			}

			public sendCommand(command: string): Promise<string> {
				return this.write(`/ ${command} \\\n`);
			}

			public sendPrimed(command: string) {
				return this.write(command + '\n');
			}

			public setModeOff() {
				return this.sendCommand('off');
			}

			public getLeds(): Promise<string> {
				return this.sendCommand('leds');
			}

			public runConfig(
				config: ArduinoAPI.ArduinoConfig,
				extra: ArduinoAPI.JoinedConfigs = {}
			): Promise<string> {
				switch (config.type) {
					case 'solid':
						return this.setSolid(
							BotUtil.BotUtil.mergeObj(config.data, extra)
						);
					case 'dot':
						return this.setDot(
							BotUtil.BotUtil.mergeObj(config.data, extra)
						);
					case 'split':
						return this.setSplit(
							BotUtil.BotUtil.mergeObj(config.data, extra)
						);
					case 'pattern':
						return this.setPattern(
							BotUtil.BotUtil.mergeObj(config.data, extra)
						);
					case 'flash':
						return this.setFlash(
							BotUtil.BotUtil.mergeObj(config.data, extra)
						);
					case 'rainbow':
						return this.setRainbow(
							BotUtil.BotUtil.mergeObj(config.data, extra)
						);
					case 'off':
						return this.setModeOff();
					case 'prime':
						return this.setPrime();
				}
			}

			public setSolid({ intensity = 0, r, g, b }: ArduinoAPI.Solid) {
				return this.sendCommand(`solid ${intensity} ${r} ${g} ${b}`);
			}

			public setDot({
				intensity = 0,
				backgroundRed,
				backgroundGreen,
				backgroundBlue,
				dots
			}: ArduinoAPI.Dot) {
				return this.sendCommand(
					`dot ${intensity} ${backgroundRed} ${backgroundGreen} ${backgroundBlue} ${dots
						.map(({ size, speed, dir, dotPos, r, g, b }) => {
							return `${size} ${speed} ${dir} ${dotPos} ${r} ${g} ${b}`;
						})
						.join(' ')}`
				);
			}

			public setSplit({
				intensity = 0,
				updateTime,
				dir,
				parts
			}: ArduinoAPI.Split) {
				return this.sendCommand(
					`split ${intensity} ${updateTime} ${dir} ${parts
						.map(({ r, g, b }) => {
							return `${r} ${g} ${b}`;
						})
						.join(' ')}`
				);
			}

			public setPattern({
				intensity = 0,
				blockSize = 0,
				updateTime,
				dir,
				parts
			}: ArduinoAPI.Pattern) {
				return this.sendCommand(
					`pattern ${intensity} ${updateTime} ${dir} ${blockSize} ${parts
						.map(({ r, g, b }) => {
							return `${r} ${g} ${b}`;
						})
						.join(' ')}`
				);
			}

			public setPrime() {
				return this.sendCommand('prime');
			}

			public setFlash({
				intensity = 0,
				colors = [],
				blockSize = 2,
				updateTime,
				mode
			}: ArduinoAPI.Flash) {
				return this.sendCommand(
					`flash ${intensity} ${updateTime} ${blockSize} ${mode}${
						colors.length ? ' ' : ''
					}${colors
						.map(({ r, g, b }) => {
							return `${r} ${g} ${b}`;
						})
						.join(' ')}`
				);
			}

			public setRainbow({
				updateTime = 1,
				blockSize = 1
			}: ArduinoAPI.Rainbow) {
				return this.sendCommand(`rainbow ${updateTime} ${blockSize}`);
			}

			public destroy() {
				if (this._dead) return;

				return new Promise(resolve => {
					this._port.close(() => {
						resolve();
					});
				});
			}
		}
	}

	export namespace Visualizer {
		export namespace Music {
			function applyTransform(data: number[]) {
				return data.reduce((prev, current) => {
					return prev + current;
				}, 0);
			}

			export namespace Youtube {
				export class Handler {
					static readonly MAX_INTENSITY = 50;
					static colorFromIntensity(intensity: number) {
						const clamped = Math.min(intensity, this.MAX_INTENSITY);
						const relativeIntensity = clamped / this.MAX_INTENSITY;
						const rgbIntensity = Math.round(
							relativeIntensity * 255
						);
						const redColor = rgbIntensity.toString(16);
						const redLonger =
							redColor.length === 1 ? '0' + redColor : redColor;
						return `${redLonger}0000`;
					}

					static parse(data: string) {
						const transformed = applyTransform(JSON.parse(data));
						console.log(
							'Writing',
							this.colorFromIntensity(transformed)
						);
						Clients.arduinoClients.forEach(c =>
							c.board.sendPrimed(
								this.colorFromIntensity(transformed)
							)
						);
					}
				}
			}
		}
	}

	export namespace Routing {
		async function switchLed(name: LED_NAMES, value: string, logObj: any) {
			const client = Clients.getLed(name);
			if (!client) return;
			if (value === '1') {
				attachMessage(
					attachMessage(
						logObj,
						`Setting`,
						chalk.bold(client.address),
						`to color rgb(255, 255, 255)`
					),
					chalk.bgHex(API.colorToHex(NIGHTSTAND_COLOR))('   ')
				);
				return client.setColor(255, 255, 255);
			} else if (value === '0') {
				attachMessage(logObj, `Turned off`, chalk.bold(client.address));
				return client.turnOff();
			}
			return Promise.resolve();
		}

		export async function init({
			app,
			randomNum,
			ws
		}: {
			app: AppWrapper;
			randomNum: number;
			ws: WSWrapper;
		}) {
			await Scan.scanRGBControllers(true);
			setInterval(Scan.scanRGBControllers, 1000 * 60 * 60);
			await External.Handler.init();

			app.post('/rgb/color', async (req, res) => {
				await API.Handler.setColor(res, { ...req.params, ...req.body });
			});
			app.post('/rgb/color/:color/:instensity?', async (req, res) => {
				await API.Handler.setColor(res, { ...req.params, ...req.body });
			});
			app.post(
				'/rgb/color/:red/:green/:blue/:intensity?',
				async (req, res) => {
					await API.Handler.setRGB(res, {
						...req.params,
						...req.body
					});
				}
			);
			app.post('/rgb/power/:power', async (req, res) => {
				await API.Handler.setPower(res, { ...req.params, ...req.body });
			});
			app.post(
				'/rgb/pattern/:pattern/:speed?/:transition?',
				async (req, res) => {
					await API.Handler.runPattern(res, {
						...req.params,
						...req.body
					});
				}
			);
			app.post('/rgb/effect/:effect', async (req, res) => {
				await API.Handler.runEffect(res, {
					...req.params,
					...req.body
				});
			});
			app.all('/rgb/refresh', async (_req, res) => {
				await API.Handler.refresh(res);
			});
			app.all('/rgb', async (req, res) => {
				await WebPage.Handler.index(res, req, randomNum);
			});
			KeyVal.GetSetListener.addListener(
				'room.lights.nightstand',
				async (value, logObj) => {
					const client = Clients.getLed(LED_NAMES.BED_LEDS);
					if (!client) return;
					if (value === '1') {
						attachMessage(
							attachMessage(
								logObj,
								`Setting`,
								chalk.bold(client.address),
								`to color rgb(${NIGHTSTAND_COLOR.r}, ${NIGHTSTAND_COLOR.g}, ${NIGHTSTAND_COLOR.b})`
							),
							chalk.bgHex(API.colorToHex(NIGHTSTAND_COLOR))('   ')
						);
						return client.setColor(
							NIGHTSTAND_COLOR.r,
							NIGHTSTAND_COLOR.g,
							NIGHTSTAND_COLOR.b
						);
					} else if (value === '0') {
						attachMessage(
							logObj,
							`Turned off`,
							chalk.bold(client.address)
						);
						return client.turnOff();
					}
					return Promise.resolve();
				}
			);

			let wakelights: NodeJS.Timeout[] = [];
			KeyVal.GetSetListener.addListener(
				'room.leds.wakelight',
				async (value, logObj) => {
					wakelights.forEach(w => clearInterval(w));
					wakelights = [];

					const client = Clients.getLed(LED_NAMES.BED_LEDS);
					if (!client) return;
					if (value === '1') {
						attachMessage(
							attachMessage(
								logObj,
								`Fading in`,
								chalk.bold(client.address),
								`to color rgb(${NIGHTSTAND_COLOR.r}, ${NIGHTSTAND_COLOR.g}, ${NIGHTSTAND_COLOR.b})`
							),
							chalk.bgHex(API.colorToHex(NIGHTSTAND_COLOR))('   ')
						);

						let count: number = 2;
						const interval = setInterval(() => {
							client.setColor(
								NIGHTSTAND_COLOR.r,
								NIGHTSTAND_COLOR.g,
								NIGHTSTAND_COLOR.b,
								count
							);

							if (count++ === 100) {
								clearInterval(interval);
								wakelights.splice(
									wakelights.indexOf(interval),
									1
								);
							}
						}, WAKELIGHT_TIME / 100);
						wakelights.push(interval);
						client.setColor(
							NIGHTSTAND_COLOR.r,
							NIGHTSTAND_COLOR.g,
							NIGHTSTAND_COLOR.b,
							1
						);
					} else if (value === '0') {
						wakelights.forEach(w => clearInterval(w));
						wakelights = [];
						attachMessage(
							logObj,
							`Turned off`,
							chalk.bold(client.address)
						);
						return client.turnOff();
					}
					return Promise.resolve();
				}
			);
			KeyVal.GetSetListener.addListener(
				'room.leds.ceiling',
				async (value, logObj) => {
					await switchLed(LED_NAMES.CEILING_LEDS, value, logObj);
				}
			);
			KeyVal.GetSetListener.addListener(
				'room.leds.bed',
				async (value, logObj) => {
					await switchLed(LED_NAMES.BED_LEDS, value, logObj);
				}
			);
			KeyVal.GetSetListener.addListener(
				'room.leds.desk',
				async (value, logObj) => {
					await switchLed(LED_NAMES.DESK_LEDS, value, logObj);
				}
			);

			ws.all('/music_visualize', async ({ addListener }) => {
				// Prime it
				if (Clients.arduinoClients.length === 0) {
					if ((await Scan.scanArduinos()) == 0) return;
				}
				Clients.arduinoClients.forEach(c =>
					c.board.sendCommand('prime')
				);

				addListener((message: string) => {
					Visualizer.Music.Youtube.Handler.parse(message);
				});
			});
		}
	}
}
