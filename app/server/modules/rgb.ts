import {
	LED_NAMES,
	NIGHTSTAND_COLOR,
	LED_DEVICE_NAME,
	MAGIC_LEDS,
	ARDUINO_LEDS,
	LED_IPS,
	WAKELIGHT_TIME,
	NAME_MAP,
	MAX_BEATS_ARR_LENGTH
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
import {
	attachMessage,
	ResDummy,
	getTime,
	log,
	attachSourcedMessage
} from '../lib/logger';
import * as ReadLine from '@serialport/parser-readline';
import { BeatChanges, FullState } from './spotify-beats';
import { SpotifyTypes } from '../types/spotify';
import { BotState } from '../lib/bot-state';
import SerialPort = require('serialport');
import { BotUtil } from '../lib/bot-util';
import { ModuleConfig } from './modules';
import { ExplainHook } from './explain';
import { colorList } from '../lib/data';
import { ResponseLike } from './multi';
import { exec } from 'child_process';
import { ModuleMeta } from './meta';
import { Bot as _Bot } from './bot';
import * as express from 'express';
import { wait } from '../lib/util';
import { KeyVal } from './keyval';
import { Auth } from './auth';
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
	export const meta = new (class Meta extends ModuleMeta {
		name = 'rgb';

		setup!: Promise<void>;

		async init(config: ModuleConfig) {
			await (this.setup = new Promise(async resolve => {
				await Scan.scanRGBControllers(true);
				setInterval(Scan.scanRGBControllers, 1000 * 60 * 60);
				await External.Handler.init();
				initListeners();

				Routing.init(config);

				resolve();
			}));
		}

		get external() {
			return External;
		}

		get bot() {
			return Bot;
		}

		addExplainHook(hook: ExplainHook) {
			Routing.initExplainHook(hook);
			API.initExplainHook(hook);
		}
	})();

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

			private _sendFailure(
				callback?: (err: Error | null, success: boolean) => void
			) {
				callback && callback({} as any, false);
				return false;
			}

			async setColor(
				red: number,
				green: number,
				blue: number,
				intensity?: number,
				callback?: (err: Error | null, success: boolean) => void
			): Promise<boolean> {
				await this._turnedOn();
				if (
					await this.board.setSolid({
						r: red,
						g: green,
						b: blue,
						intensity
					})
				) {
					return this._sendSuccess(callback);
				} else {
					return this._sendFailure(callback);
				}
			}
			async setColorAndWarmWhite(
				red: number,
				green: number,
				blue: number,
				_ww: number,
				callback?: (err: Error | null, success: boolean) => void
			): Promise<boolean> {
				await this._turnedOn();
				if (await this.board.setSolid({ r: red, g: green, b: blue })) {
					return this._sendSuccess(callback);
				} else {
					return this._sendFailure(callback);
				}
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
				if (
					await this.board.setSolid({
						r: red * brightnessScale,
						g: green * brightnessScale,
						b: blue * brightnessScale,
						intensity
					})
				) {
					return this._sendSuccess(callback);
				} else {
					return this._sendFailure(callback);
				}
			}
			async setCustomPattern(
				pattern: CustomMode,
				speed: number,
				callback?: () => void
			): Promise<boolean> {
				await this._turnedOn();
				if (
					await this.board.setFlash({
						colors: pattern.colors.map(
							({ red, green, blue }) =>
								new Color(red, green, blue)
						),
						mode: pattern.transitionType,
						updateTime: speedToMs(speed)
					})
				) {
					return this._sendSuccess(callback);
				} else {
					return this._sendFailure(callback);
				}
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
				if (await this.board.setSolid(new Color(ww))) {
					return this._sendSuccess(callback);
				} else {
					return this._sendFailure(callback);
				}
			}
			async turnOff(callback?: () => void): Promise<boolean> {
				await this._turnedOff();
				if (await this.board.setModeOff()) {
					return this._sendSuccess(callback);
				} else {
					return this._sendFailure(callback);
				}
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

		export interface Random {
			blockSize?: number;
			updateTime: number;
		}

		export type Beats =
			| {
					random?: false;
					backgroundRed: number;
					backgroundGreen: number;
					backgroundBlue: number;
					color: Color;
					progress?: Color;
			  }
			| {
					random: true;
					blockSize: number;
			  };

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
			  }
			| {
					type: 'random';
					data: Random;
			  }
			| {
					type: 'beats';
					data: Beats;
			  };

		export type JoinedConfigs = Partial<
			Solid & Dot & Split & Pattern & Flash
		>;

		export type Effects =
			| 'rainbow'
			| 'reddot'
			| 'reddotbluebg'
			| 'multidot'
			| 'multidotdiffspeed'
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
			| 'desk'
			| 'randomslow'
			| 'randomslowbig'
			| 'randomfast'
			| 'randomblocks'
			| 'randomparty'
			| 'randomfull'
			| 'randomfullfast'
			| 'beats1' // Red on black
			| 'beats2' // Red on blue
			| 'beats3' // Blue on black
			| 'beats4' // Red on black with a green progress bar
			| 'beats5' // Red on blue with a green progress bar
			| 'beatrandomsmall'
			| 'beatrandommedium'
			| 'beatrandombig';

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
				[K in Effects]: ArduinoConfig & {
					description: string;
				};
			} = {
			rainbow: {
				description: 'Forwards moving rainbow pattern',
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
				description: 'Slightly bigger block size rainbow',
				type: 'rainbow',
				data: {
					updateTime: 1,
					blockSize: 2
				}
			},
			reddot: {
				description: 'Single red dot moving',
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
				description: 'A bunch of dots moving',
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
			multidotdiffspeed: {
				description: 'A bunch of dots moving at different speeds',
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
							speed: 2
						},
						{
							r: 0,
							g: 0,
							b: 255,
							dir: DIR.DIR_FORWARDS,
							dotPos: 24,
							size: 5,
							speed: 3
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
							speed: 2
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
				description: 'A red dot moving on a blue background',
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
				description: 'A bunch of moving chunks of colors',
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
				description: 'Red green and blue dots moving in a pattern',
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
				description: 'A very fast strobe',
				type: 'flash',
				data: {
					mode: 'strobe',
					blockSize: 2,
					intensity: getIntensityPercentage(100),
					updateTime: 1
				}
			},
			strobe: {
				description: 'A bunch of moving chunks of colors',
				type: 'flash',
				data: {
					mode: 'strobe',
					blockSize: 7,
					intensity: getIntensityPercentage(100),
					updateTime: 60
				}
			},
			slowstrobe: {
				description: 'A slow strobe',
				type: 'flash',
				data: {
					mode: 'strobe',
					blockSize: 3,
					intensity: getIntensityPercentage(100),
					updateTime: 500
				}
			},
			brightstrobe: {
				description: 'A very bright, annoying strobe',
				type: 'flash',
				data: {
					mode: 'strobe',
					blockSize: 3,
					intensity: getIntensityPercentage(100),
					updateTime: 1000
				}
			},
			epileptisch: {
				description: 'A superfast flash',
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
				description: 'A quickly fading in and out white color',
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
				description: 'A slowly fading white color',
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
				description: 'An illumination of just my desk',
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
			},
			randomslow: {
				description: 'A slow flash of random colors of block size 1',
				type: 'random',
				data: {
					updateTime: 1000,
					blockSize: 1
				}
			},
			randomslowbig: {
				description: 'A slow flash of random colors of block size 10',
				type: 'random',
				data: {
					updateTime: 1000,
					blockSize: 10
				}
			},
			randomblocks: {
				description: 'A fast flash of big chunks of random colors',
				type: 'random',
				data: {
					updateTime: 1,
					blockSize: 20
				}
			},
			randomfast: {
				description: 'A fast flash of random colors of block size 1',
				type: 'random',
				data: {
					updateTime: 1,
					blockSize: 1
				}
			},
			randomparty: {
				description: 'Big slow chunks',
				type: 'random',
				data: {
					updateTime: 150,
					blockSize: 75
				}
			},
			randomfull: {
				description: 'A single random color updating slowly',
				type: 'random',
				data: {
					updateTime: 150,
					blockSize: 10000
				}
			},
			randomfullfast: {
				description: 'A single random color updating quickly',
				type: 'random',
				data: {
					updateTime: 1,
					blockSize: 10000
				}
			},
			beats1: {
				description:
					'Red beats on a black background with no progress bar',
				type: 'beats',
				data: {
					color: new Color(255, 0, 0),
					backgroundRed: 0,
					backgroundGreen: 0,
					backgroundBlue: 0,
					progress: new Color(0, 0, 0)
				}
			},
			beats2: {
				description:
					'Red beats on a blue background with no progress bar',
				type: 'beats',
				data: {
					color: new Color(255, 0, 0),
					backgroundRed: 0,
					backgroundGreen: 0,
					backgroundBlue: 100,
					progress: new Color(0, 0, 0)
				}
			},
			beats3: {
				description:
					'Blue beats on a black background with no progress bar',
				type: 'beats',
				data: {
					color: new Color(0, 0, 255),
					backgroundRed: 0,
					backgroundGreen: 0,
					backgroundBlue: 0,
					progress: new Color(0, 0, 0)
				}
			},
			beats4: {
				description:
					'Red beats on a black background with a green progress bar',
				type: 'beats',
				data: {
					color: new Color(255, 0, 0),
					backgroundRed: 0,
					backgroundGreen: 0,
					backgroundBlue: 0,
					progress: new Color(0, 100, 0)
				}
			},
			beats5: {
				description:
					'REd beats on a blue background with a green progress bar',
				type: 'beats',
				data: {
					color: new Color(255, 0, 0),
					backgroundRed: 0,
					backgroundGreen: 0,
					backgroundBlue: 255,
					progress: new Color(0, 100, 0)
				}
			},
			beatrandomsmall: {
				description: 'Random colors of size 1 updating on the beat',
				type: 'beats',
				data: {
					random: true,
					blockSize: 1
				}
			},
			beatrandommedium: {
				description: 'Random colors of size 20 updating on the beat',
				type: 'beats',
				data: {
					random: true,
					blockSize: 20
				}
			},
			beatrandombig: {
				description: 'Random colors of size 75 updating on the beat',
				type: 'beats',
				data: {
					random: true,
					blockSize: 75
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

		let explainHook: ExplainHook | null = null;

		export function initExplainHook(hook: ExplainHook) {
			explainHook = hook;
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
				},
				source: string
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
						attachSourcedMessage(
							res,
							source,
							explainHook,
							`rgb(${r}, ${g}, ${b})`
						),
						chalk.bgHex(hexColor)('   ')
					),
					`Updated ${Clients.clients!.length} clients`
				);

				if (
					(
						await Promise.all(
							Clients.clients!.map(async client => {
								return (
									await Promise.all([
										client.setColorWithBrightness(
											r,
											g,
											b,
											100,
											intensity
										),
										client.turnOn()
									])
								).every(v => v);
							})
						)
					).every(v => v)
				) {
					res.status(200).end();
					return true;
				} else {
					res.status(500).write('Failed to write value');
					res.end();
					return false;
				}
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
				},
				source: string
			) {
				const redNum = Math.min(255, Math.max(0, parseInt(red, 10)));
				const greenNum = Math.min(
					255,
					Math.max(0, parseInt(green, 10))
				);
				const blueNum = Math.min(255, Math.max(0, parseInt(blue, 10)));
				attachMessage(
					attachMessage(
						attachSourcedMessage(
							res,
							source,
							explainHook,
							`rgb(${red}, ${green}, ${blue})`
						),
						chalk.bgHex(rgbToHex(redNum, greenNum, blueNum))('   ')
					),
					`Updated ${Clients.clients!.length} clients`
				);

				if (
					(
						await Promise.all(
							Clients.clients!.map(async client => {
								return (
									await Promise.all([
										client.setColorWithBrightness(
											redNum,
											greenNum,
											blueNum,
											100,
											intensity
										),
										client.turnOn()
									])
								).every(v => v);
							})
						)
					).every(v => v)
				) {
					res.status(200).end();
					return true;
				} else {
					res.status(500).write('Failed to write value');
					res.end();
					return false;
				}
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
				},
				source: string
			) {
				attachMessage(
					attachSourcedMessage(
						res,
						source,
						explainHook,
						`Turned ${power}`
					),
					`Updated ${Clients.clients!.length} clients`
				);
				if (
					(
						await Promise.all(
							Clients.clients!.map(c =>
								power === 'on' ? c.turnOn() : c.turnOff()
							)
						)
					).every(v => v)
				) {
					res.status(200).end();
					return true;
				} else {
					res.status(500).write('Failed to write data');
					res.end();
					return false;
				}
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
				},
				source: string
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
					attachSourcedMessage(
						res,
						source,
						explainHook,
						`Running pattern ${patternName}`
					),
					`Updated ${usedClients!.length} clients`
				);
				try {
					if (
						(
							await Promise.all(
								usedClients!.map(async c => {
									return (
										await Promise.all([
											c.setCustomPattern(
												pattern,
												speed || defaultSpeed
											),
											c.turnOn()
										])
									).every(v => v);
								})
							)
						).every(v => v)
					) {
						res.status(200).end();
						return true;
					}
				} catch (e) {}
				res.status(400).write('Failed to run pattern');
				res.end();
				return false;
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
				},
				source: string
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
							attachSourcedMessage(
								res,
								source,
								explainHook,
								`Running effect ${effectName}`
							),
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
				},
				source: string
			) {
				attachMessage(
					attachSourcedMessage(
						res,
						source,
						explainHook,
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
			resolver: (value: boolean) => void;
			source: string;
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

			constructor(private _logObj: any, private _source: string) {}

			private static async _handleRequest(request: ExternalRequest) {
				const { logObj, resolver, source } = request;
				const resDummy = new ResDummy();
				let value = undefined;
				if (request.type === 'color') {
					if ('color' in request) {
						value = await API.Handler.setColor(
							resDummy,
							{
								color: request.color,
								intensity: request.intensity,
								auth: await Auth.Secret.getKey()
							},
							source
						);
					} else {
						const { r, g, b } = request;
						value = await API.Handler.setRGB(
							resDummy,
							{
								red: r,
								green: g,
								blue: b,
								intensity: request.intensity,
								auth: await Auth.Secret.getKey()
							},
							source
						);
					}
				} else if (request.type == 'power') {
					value = await API.Handler.setPower(
						resDummy,
						{
							power: request.state,
							auth: await Auth.Secret.getKey()
						},
						source
					);
				} else if (request.type === 'effect') {
					value = await API.Handler.runEffect(
						resDummy,
						{
							effect: request.name,
							auth: await Auth.Secret.getKey(),
							...request.extra
						},
						source
					);
				} else if (request.type === 'config') {
					value = await API.Handler.runConfig(
						resDummy,
						{
							config: request.config,
							auth: await Auth.Secret.getKey()
						},
						source
					);
				} else {
					const { name, speed, transition } = request;
					value = await API.Handler.runPattern(
						resDummy,
						{
							pattern: name as any,
							speed,
							transition,
							auth: await Auth.Secret.getKey()
						},
						source
					);
				}
				resDummy.transferTo(logObj);
				resolver(value);
			}

			async color(
				color: string,
				intensity: number = 0
			): Promise<boolean> {
				return new Promise<boolean>(resolve => {
					const req: ExternalRequest = {
						type: 'color',
						color: color,
						intensity,
						logObj: this._logObj,
						resolver: resolve,
						source: this._source
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
			): Promise<boolean> {
				return new Promise(resolve => {
					const req: ExternalRequest = {
						type: 'color',
						r: red,
						g: green,
						b: blue,
						intensity,
						logObj: this._logObj,
						resolver: resolve,
						source: this._source
					};
					if (Handler._ready) {
						Handler._handleRequest(req);
					} else {
						Handler._requests.push(req);
					}
				});
			}

			async power(state: 'on' | 'off'): Promise<boolean> {
				return new Promise(resolve => {
					const req: ExternalRequest = {
						type: 'power',
						state: state,
						logObj: this._logObj,
						resolver: resolve,
						source: this._source
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
			): Promise<boolean> {
				return new Promise(resolve => {
					const req: ExternalRequest = {
						type: 'pattern',
						name,
						speed,
						transition,
						logObj: this._logObj,
						resolver: resolve,
						source: this._source
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
			): Promise<boolean> {
				return new Promise(resolve => {
					const req: ExternalRequest = {
						type: 'effect',
						name,
						extra,
						logObj: this._logObj,
						resolver: resolve,
						source: this._source
					};
					if (Handler._ready) {
						Handler._handleRequest(req);
					} else {
						Handler._requests.push(req);
					}
				});
			}

			async runConfig(
				config: ArduinoAPI.ArduinoConfig
			): Promise<boolean> {
				return new Promise(resolve => {
					const req: ExternalRequest = {
						type: 'config',
						config,
						logObj: this._logObj,
						resolver: resolve,
						source: this._source
					};
					if (Handler._ready) {
						Handler._handleRequest(req);
					} else {
						Handler._requests.push(req);
					}
				});
			}
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
				'/reconnect': 'Reconnect to arduino board',
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
						state.states.RGB.lastConfig = {
							type: 'off'
						};
					}
					function rgbOn(state: _Bot.Message.StateKeeping.ChatState) {
						state.states.RGB.lastConfig = {
							type: 'solid',
							data: new Color(100)
						};
					}
					mm('/rgbon', async ({ state, logObj, matchText }) => {
						rgbOn(state);
						if (
							await new External.Handler(
								logObj,
								`BOT.${matchText}`
							).power('on')
						) {
							return `Turned it on`;
						} else {
							return 'Failed to turn it on';
						}
					});
					mm('/rgboff', async ({ state, logObj, matchText }) => {
						rgbOff(state);
						if (
							await new External.Handler(
								logObj,
								`BOT.${matchText}`
							).power('off')
						) {
							return `Turned it off`;
						} else {
							return 'Failed tot turn it on';
						}
					});
					mm(
						/turn (on|off) (rgb|led)/,
						async ({ logObj, match, state, matchText }) => {
							const targetState = match[1];
							if (targetState === 'on') {
								rgbOn(state);
							} else {
								rgbOff(state);
							}
							if (
								await new External.Handler(
									logObj,
									`BOT.${matchText}`
								).power(targetState as 'on' | 'off')
							) {
								return `Turned it ${targetState}`;
							} else {
								return `Failed to turn it ${targetState}`;
							}
						}
					);
					mm(
						'/arduinooff',
						/turn (on|off) (ceiling|arduino|duino)/,
						async ({ logObj, match, state }) => {
							const targetState =
								match.length === 0 ? 'off' : match[1];
							if (targetState === 'on') {
								state.states.RGB.lastConfig = {
									type: 'solid',
									data: new Color(100)
								};
							} else {
								state.states.RGB.lastConfig = {
									type: 'off'
								};
							}
							if (
								(
									await Promise.all(
										Clients.arduinoClients.map(c =>
											targetState === 'on'
												? c.turnOn()
												: c.turnOff()
										)
									)
								).every(v => v)
							) {
								attachMessage(
									logObj,
									`Turned ${targetState} ${Clients.arduinoClients.length} arduino clients`
								);
								return `Turned ${targetState} ${Clients.arduinoClients.length} arduino clients`;
							} else {
								return `Failed to turn ${targetState} ${Clients.arduinoClients.length} arduino clients`;
							}
						}
					);
					mm(
						'/magicoff',
						/turn (on|off) (magic(-| )home)/,
						async ({ logObj, match }) => {
							const targetState =
								match.length === 0 ? 'off' : match[1];

							if (
								(
									await Promise.all(
										Clients.magicHomeClients.map(c =>
											targetState === 'on'
												? c.turnOff()
												: c.turnOff()
										)
									)
								).every(v => v)
							) {
								attachMessage(
									logObj,
									`Turned ${targetState} ${Clients.magicHomeClients.length} magichome clients`
								);
								return `Turned ${targetState} ${Clients.magicHomeClients.length} magichome clients`;
							} else {
								return `Failed to turn ${targetState} ${Clients.magicHomeClients.length} magichome clients`;
							}
						}
					);
					mm(
						/\/color (?:(?:(\d+) (\d+) (\d+))|([^ ]+))/,
						/set (?:rgb|led(?:s)?|it|them|color) to (?:(?:(\d+) (\d+) (\d+))|([^ ]+))(\s+with intensity (\d+))?/,
						async ({ logObj, match, state, matchText }) => {
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
								state.states.RGB.lastConfig = {
									type: 'solid',
									data: new Color(
										resolvedColor.r,
										resolvedColor.g,
										resolvedColor.b
									)
								};
							} else {
								state.states.RGB.lastConfig = null;
							}
							if (
								resolvedColor &&
								(await new External.Handler(
									logObj,
									`BOT.${matchText}`
								).rgb(
									resolvedColor.r + '',
									resolvedColor.g + '',
									resolvedColor.b + '',
									intensity?.length
										? parseInt(intensity, 10)
										: 0
								))
							) {
								return `Set color to ${JSON.stringify(
									resolvedColor
								)}`;
							} else {
								return 'Failed to set color (invalid color or bad connection to board)';
							}
						}
					);
					mm(
						/\/pattern ([^ ]+)/,
						/(?:start|launch) pattern ([^ ]+)(\s+with speed ([^ ]+))?(\s*and\s*)?(with transition ([^ ]+))?(\s*and\s*)?(\s*with speed ([^ ]+))?/,
						async ({ logObj, match, state, matchText }) => {
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

							state.states.RGB.lastConfig = null;

							if (
								await new External.Handler(
									logObj,
									`BOT.${matchText}`
								).pattern(
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
						async ({ logObj, match, state, matchText }) => {
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
								state.states.RGB.lastConfig = {
									...ArduinoAPI.arduinoEffects[effect]
								};
								if ('data' in state.states.RGB.lastConfig) {
									state.states.RGB.lastConfig.data = Bot.mergeObj(
										state.states.RGB.lastConfig.data,
										Bot.unsetUndefined(config)
									);
								}
							} else {
								state.states.RGB.lastConfig = null;
								return `Effect "${effect}" does not exist`;
							}

							if (
								await new External.Handler(
									logObj,
									`BOT.${matchText}`
								).effect(effect, config)
							) {
								return `Started effect "${effect}" with config ${JSON.stringify(
									Bot.mergeObj(
										ArduinoAPI.arduinoEffects[effect],
										Bot.unsetUndefined(config)
									)
								)}`;
							} else {
								return 'Failed to start effect';
							}
						}
					);
					mm(
						/(create) effect ([^ ]+)(\s+with intensity ([^ ]+))?(\s*and\s*)?(\s*with background (((\d+) (\d+) (\d+))|([^ ]+)))?(\s*and\s*)?(\s*with update(-| )?time ([^ ]+))?(\s*and\s*)?(\s*with dir(ection)? ([^ ]+))?(\s*and\s*)?(\s*with (?:(?:block(-| )?size)|per(-| )?strobe) ([^ ]+))?(\s*and\s*)?(\s*with mode ([^ ]+))?(\s*and\s*)?(\s*with color (((\d+) (\d+) (\d+))|([^ ]+)))?/,
						async ({ logObj, match, state, matchText }) => {
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

							state.states.RGB.lastConfig = {
								type,
								data: { ...config }
							} as any;

							if (
								await new External.Handler(
									logObj,
									`BOT.${matchText}`
								).runConfig({
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
						async ({ logObj, state, match, matchText }) => {
							if (state.states.RGB.lastConfig === null) {
								attachMessage(logObj, 'No lastConfig for RGB');
								return 'I don\'t know what to edit';
							}
							state.states.RGB.lastConfig.data =
								state.states.RGB.lastConfig.data || {};
							state.states.RGB.lastConfig.data.intensity = parseInt(
								match[1],
								10
							);
							const msg = `Changed config to ${JSON.stringify(
								state.states.RGB.lastConfig
							)} (intensity->${
								state.states.RGB.lastConfig.data.intensity
							})`;
							attachMessage(logObj, msg);
							if (
								await new External.Handler(
									logObj,
									`BOT.${matchText}`
								).runConfig(state.states.RGB.lastConfig)
							) {
								return msg;
							} else {
								return 'Failed to set intensity';
							}
						}
					);
					mm(
						/\/blocksize ([^ ]+)/,
						/(?:change|set) (?:(?:block(?:-| )?size)|per(?:-| )?strobe) to ([^ ]+)/,
						async ({ logObj, state, match, matchText }) => {
							if (state.states.RGB.lastConfig === null) {
								attachMessage(logObj, 'No lastConfig for RGB');
								return 'I don\'t know what to edit';
							}
							state.states.RGB.lastConfig.data =
								state.states.RGB.lastConfig.data || {};
							state.states.RGB.lastConfig.data.blockSize = parseInt(
								match[1],
								10
							);
							const msg = `Changed config to ${JSON.stringify(
								state.states.RGB.lastConfig
							)} (blockSize->${
								state.states.RGB.lastConfig.data.blockSize
							})`;
							attachMessage(logObj, msg);
							if (
								await new External.Handler(
									logObj,
									`BOT.${matchText}`
								).runConfig(state.states.RGB.lastConfig)
							) {
								return msg;
							} else {
								return 'Failed to set blocksize';
							}
						}
					);
					mm(
						/\/red (\d+)/,
						/(?:change|set) r(?:ed)? to (\d+)/,
						async ({ logObj, state, match, matchText }) => {
							if (state.states.RGB.lastConfig === null) {
								attachMessage(logObj, 'No lastConfig for RGB');
								return 'I don\'t know what to edit';
							}
							state.states.RGB.lastConfig.data =
								state.states.RGB.lastConfig.data || {};
							state.states.RGB.lastConfig.data.r = parseInt(
								match[1],
								10
							);
							const msg = `Changed config to ${JSON.stringify(
								state.states.RGB.lastConfig
							)} (r->${state.states.RGB.lastConfig.data.r})`;
							attachMessage(logObj, msg);
							if (
								await new External.Handler(
									logObj,
									`BOT.${matchText}`
								).runConfig(state.states.RGB.lastConfig)
							) {
								return msg;
							} else {
								return 'Failed to set red';
							}
						}
					);
					mm(
						/\/green (\d+)/,
						/(?:change|set) g(?:reen)? to (\d+)/,
						async ({ logObj, state, match, matchText }) => {
							if (state.states.RGB.lastConfig === null) {
								attachMessage(logObj, 'No lastConfig for RGB');
								return 'I don\'t know what to edit';
							}
							state.states.RGB.lastConfig.data =
								state.states.RGB.lastConfig.data || {};
							state.states.RGB.lastConfig.data.g = parseInt(
								match[1],
								10
							);
							const msg = `Changed config to ${JSON.stringify(
								state.states.RGB.lastConfig
							)} (g->${state.states.RGB.lastConfig.data.g})`;
							attachMessage(logObj, msg);
							if (
								await new External.Handler(
									logObj,
									`BOT.${matchText}`
								).runConfig(state.states.RGB.lastConfig)
							) {
								return msg;
							} else {
								return 'Failed to set green';
							}
						}
					);
					mm(
						/\/blue (\d+)/,
						/(?:change|set) r(?:blue)? to (\d+)/,
						async ({ logObj, state, match, matchText }) => {
							if (state.states.RGB.lastConfig === null) {
								attachMessage(logObj, 'No lastConfig for RGB');
								return 'I don\'t know what to edit';
							}
							state.states.RGB.lastConfig.data =
								state.states.RGB.lastConfig.data || {};
							state.states.RGB.lastConfig.data.b = parseInt(
								match[1],
								10
							);
							const msg = `Changed config to ${JSON.stringify(
								state.states.RGB.lastConfig
							)} (b->${state.states.RGB.lastConfig.data.b})`;
							attachMessage(logObj, msg);
							if (
								await new External.Handler(
									logObj,
									`BOT.${matchText}`
								).runConfig(state.states.RGB.lastConfig)
							) {
								return msg;
							} else {
								return 'Failed to set blue';
							}
						}
					);
					mm(
						/(?:change|set) (color|part)( \d+)? to (((\d+) (\d+) (\d+))|([^ ]+))/,
						async ({ logObj, state, match, matchText }) => {
							if (state.states.RGB.lastConfig === null) {
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

							state.states.RGB.lastConfig.data =
								state.states.RGB.lastConfig.data || {};
							state.states.RGB.lastConfig.data.r = color.r;
							state.states.RGB.lastConfig.data.g = color.g;
							state.states.RGB.lastConfig.data.b = color.b;
							state.states.RGB.lastConfig.data.colors =
								state.states.RGB.lastConfig.data.colors || [];
							state.states.RGB.lastConfig.data.parts =
								state.states.RGB.lastConfig.data.parts || [];
							state.states.RGB.lastConfig.data.colors[
								colorIndex
							] = {
								...color
							};
							state.states.RGB.lastConfig.data.parts[
								colorIndex
							] = {
								...color
							};
							const msg = `Changed config to ${JSON.stringify(
								state.states.RGB.lastConfig
							)} (color->${JSON.stringify(color)})`;
							attachMessage(logObj, msg);
							if (
								await new External.Handler(
									logObj,
									`BOT.${matchText}`
								).runConfig(state.states.RGB.lastConfig)
							) {
								return msg;
							} else {
								return 'Failed to set config';
							}
						}
					);
					mm(
						/\/background (?:(?:(\d+) (\d+) (\d+))|([^ ]+))/,
						/(?:change|set) background(?:-| )?(?:color)? to (?:(?:(\d+) (\d+) (\d+))|([^ ]+))/,
						async ({ logObj, state, match, matchText }) => {
							if (state.states.RGB.lastConfig === null) {
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

							state.states.RGB.lastConfig.data =
								state.states.RGB.lastConfig.data || {};
							state.states.RGB.lastConfig.data.backgroundRed =
								color.r;
							state.states.RGB.lastConfig.data.backgroundGreen =
								color.g;
							state.states.RGB.lastConfig.data.backgroundBlue =
								color.b;
							const msg = `Changed config to ${JSON.stringify(
								state.states.RGB.lastConfig
							)} (color->${JSON.stringify(color)})`;
							attachMessage(logObj, msg);
							if (
								await new External.Handler(
									logObj,
									`BOT.${matchText}`
								).runConfig(state.states.RGB.lastConfig)
							) {
								return msg;
							} else {
								return 'Failed to set background';
							}
						}
					);
					mm(
						/\/dot (?:(?:(\d+) (\d+) (\d+))|([^ ]+))/,
						/(?:change|set) dot (\d+)?('s)? ([^ ]+) to ([^ ]+)/,
						async ({ logObj, state, match, matchText }) => {
							if (state.states.RGB.lastConfig === null) {
								attachMessage(logObj, 'No lastConfig for RGB');
								return 'I don\'t know what to edit';
							}

							const dotIndex = parseInt(match[1], 10);
							const prop = match[3];
							const value =
								prop === 'dir'
									? Bot.parseDir(match[4])
									: parseInt(match[4], 10);

							state.states.RGB.lastConfig.data =
								state.states.RGB.lastConfig.data || {};
							state.states.RGB.lastConfig.data.dots =
								state.states.RGB.lastConfig.data.dots || [];
							(state.states.RGB.lastConfig.data.dots[
								dotIndex
							] as any)[prop] = value;
							const msg = `Changed config to ${JSON.stringify(
								state.states.RGB.lastConfig
							)} (dot[${dotIndex}].${prop}->${value})`;
							attachMessage(logObj, msg);
							if (
								await new External.Handler(
									logObj,
									`BOT.${matchText}`
								).runConfig(state.states.RGB.lastConfig)
							) {
								return msg;
							} else {
								return 'Failed to set dot';
							}
						}
					);
					mm(
						/\/updatetime ([^ ]+)/,
						/(?:change|set) update(?:-| )?time to ([^ ]+)/,
						async ({ logObj, state, match, matchText }) => {
							if (state.states.RGB.lastConfig === null) {
								attachMessage(logObj, 'No lastConfig for RGB');
								return 'I don\'t know what to edit';
							}
							state.states.RGB.lastConfig.data =
								state.states.RGB.lastConfig.data || {};
							state.states.RGB.lastConfig.data.updateTime = parseInt(
								match[1],
								10
							);
							const msg = `Changed config to ${JSON.stringify(
								state.states.RGB.lastConfig
							)} (updateTime->${
								state.states.RGB.lastConfig.data.updateTime
							})`;
							attachMessage(logObj, msg);
							if (
								await new External.Handler(
									logObj,
									`BOT.${matchText}`
								).runConfig(state.states.RGB.lastConfig)
							) {
								return msg;
							} else {
								return 'Failed to set updatetime';
							}
						}
					);
					mm(
						/\/dir ([^ ]+)/,
						/(?:change|set) dir to ([^ ]+)/,
						async ({ logObj, state, match, matchText }) => {
							if (state.states.RGB.lastConfig === null) {
								attachMessage(logObj, 'No lastConfig for RGB');
								return 'I don\'t know what to edit';
							}
							state.states.RGB.lastConfig.data =
								state.states.RGB.lastConfig.data || {};
							state.states.RGB.lastConfig.data.dir = Bot.parseDir(
								match[1]
							);
							const msg = `Changed config to ${JSON.stringify(
								state.states.RGB.lastConfig
							)} (dir->${state.states.RGB.lastConfig.data.dir})`;
							attachMessage(logObj, msg);
							if (
								await new External.Handler(
									logObj,
									`BOT.${matchText}`
								).runConfig(state.states.RGB.lastConfig)
							) {
								return msg;
							} else {
								return 'Failed to set dir';
							}
						}
					);
					mm(
						/\/mode ([^ ]+)/,
						/(?:change|set) mode to ([^ ]+)/,
						async ({ logObj, state, match, matchText }) => {
							if (state.states.RGB.lastConfig === null) {
								attachMessage(logObj, 'No lastConfig for RGB');
								return 'I don\'t know what to edit';
							}
							state.states.RGB.lastConfig.data =
								state.states.RGB.lastConfig.data || {};
							state.states.RGB.lastConfig.data.mode = match[1] as TransitionTypes;
							const msg = `Changed config to ${JSON.stringify(
								state.states.RGB.lastConfig
							)} (mode->${
								state.states.RGB.lastConfig.data.mode
							})`;
							attachMessage(logObj, msg);
							if (
								await new External.Handler(
									logObj,
									`BOT.${matchText}`
								).runConfig(state.states.RGB.lastConfig)
							) {
								return msg;
							} else {
								return 'Failed to set mode';
							}
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
										client.board.resetListener();
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
					mm('/reconnect', /reconnect( to arduino)?/, async () => {
						log(
							getTime(),
							chalk.red(`[self]`, 'Reconnecting to arduino')
						);
						const amount = await Scan.scanArduinos();
						return `Found ${amount} arduino clients`;
					});
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
		export async function tryConnectToSerial() {
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
						this.resetListener();
					});
					this.getLeds();
					setTimeout(() => {
						resolve(false);
					}, 1000);
				});
			}

			public resetListener() {
				this.setListener(line => {
					log(
						getTime(),
						chalk.cyan(`[${this.name}]`),
						`# ${line.toString()}`
					);
				});
			}

			public async write(
				data: string,
				response: string | null = 'ack'
			): Promise<string | null> {
				if (response === null) {
					this._port.write(data);
					return data;
				}

				let acked: boolean = false;
				let ackPromise = new Promise(resolve => {
					this.setListener((line: string) => {
						if (line.indexOf(response) !== -1) {
							acked = true;
							resolve();
							this.resetListener();
						}
					});
				});

				let attempts: number = 0;
				while (attempts < 10 && !acked) {
					this._port.write(data);

					attempts++;
					await Promise.race([ackPromise, wait(200)]);
				}
				if (!acked) {
					log(chalk.yellow('Not acknowledged', data));
				}
				if (acked || process.argv.indexOf('--debug') > -1) return data;

				return null;
			}

			public sendCommand(
				command: string,
				waitForAck: boolean = true
			): Promise<string | null> {
				return this.write(
					`/ ${command} \\\n`,
					waitForAck ? 'ack' : null
				);
			}

			public primeForCommands() {
				return this.write('>\n', '|1');
			}

			public cancelPrime() {
				return this.write('<\n', null);
			}

			public sendPrimed(command: string): Promise<string | null> {
				return this.write(command + '\n');
			}

			public setModeOff(): Promise<string | null> {
				return this.sendCommand('off');
			}

			public getLeds(): Promise<string | null> {
				return this.sendCommand('leds');
			}

			public runConfig(
				config: ArduinoAPI.ArduinoConfig,
				extra: ArduinoAPI.JoinedConfigs = {}
			): Promise<string | null> {
				BeatFlash.setEnabled(this, config.type === 'beats');

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
					case 'random':
						return this.setRandom(
							BotUtil.BotUtil.mergeObj(config.data, extra)
						);
					case 'beats':
						return this.setBeats(
							BotUtil.BotUtil.mergeObj(config.data, extra)
						);
				}
			}

			public setSolid({
				intensity = 0,
				r,
				g,
				b
			}: ArduinoAPI.Solid): Promise<string | null> {
				return this.sendCommand(`solid ${intensity} ${r} ${g} ${b}`);
			}

			public setDot({
				intensity = 0,
				backgroundRed,
				backgroundGreen,
				backgroundBlue,
				dots
			}: ArduinoAPI.Dot): Promise<string | null> {
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
			}: ArduinoAPI.Split): Promise<string | null> {
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
			}: ArduinoAPI.Pattern): Promise<string | null> {
				return this.sendCommand(
					`pattern ${intensity} ${updateTime} ${dir} ${blockSize} ${parts
						.map(({ r, g, b }) => {
							return `${r} ${g} ${b}`;
						})
						.join(' ')}`
				);
			}

			public setRandom({
				blockSize = 0,
				updateTime
			}: ArduinoAPI.Random): Promise<string | null> {
				return this.sendCommand(`random ${updateTime} ${blockSize}`);
			}

			public setPrime(): Promise<string | null> {
				return this.sendCommand('prime');
			}

			public setBeats(config: ArduinoAPI.Beats): Promise<string | null> {
				if (config.random) {
					const { blockSize } = config;
					return this.sendCommand(
						`beats 1 ${blockSize} ${0} ${0} ${0} ${0} ${0} ${0} ${0} ${0} ${0}`
					);
				} else {
					const {
						color,
						backgroundBlue,
						backgroundGreen,
						backgroundRed,
						progress = {
							r: 0,
							g: 0,
							b: 0
						}
					} = config;
					return this.sendCommand(
						`beats 0 0 ${color.r} ${color.g} ${color.b} ${backgroundRed} ${backgroundGreen} ${backgroundBlue} ${progress.r} ${progress.g} ${progress.b}`
					);
				}
			}

			public setFlash({
				intensity = 0,
				colors = [],
				blockSize = 2,
				updateTime,
				mode
			}: ArduinoAPI.Flash): Promise<string | null> {
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
			}: ArduinoAPI.Rainbow): Promise<string | null> {
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

		export namespace BeatFlash {
			type UpdateMap = {
				[K in keyof FullState]-?: number | null;
			};

			let enabledMap: WeakMap<Board.Board, boolean> = new WeakMap();
			const boardLastUpdateMap: WeakMap<
				Board.Board,
				UpdateMap
			> = new WeakMap();
			const stateLastUpdateMap: UpdateMap = {
				beats: null,
				duration: null,
				playStart: null,
				playState: null,
				playbackTime: null
			};

			export function setEnabled(board: Board.Board, enabled: boolean) {
				enabledMap.set(board, enabled);
			}

			export async function notifyChanges(
				state: FullState,
				changes: BeatChanges
			) {
				await meta.setup;

				for (const change in changes) {
					stateLastUpdateMap[change as keyof FullState] = Date.now();
				}

				await Promise.all(
					Clients.arduinoBoards
						.filter(board => {
							return (
								enabledMap.has(board) && enabledMap.get(board)
							);
						})
						.map(async board => {
							if (!boardLastUpdateMap.has(board)) {
								boardLastUpdateMap.set(board, {
									beats: null,
									duration: null,
									playStart: null,
									playState: null,
									playbackTime: null
								});
							}
							const boardUpdateMap = boardLastUpdateMap.get(
								board
							)!;

							const boardChanges: BeatChanges = { ...changes };
							for (const key in boardUpdateMap) {
								const changeKey = key as keyof BeatChanges;
								const boardKeyState = boardUpdateMap[changeKey];
								const globalKeyState =
									stateLastUpdateMap[changeKey];

								if (
									boardKeyState === null ||
									(globalKeyState !== null &&
										globalKeyState > boardKeyState)
								) {
									(boardChanges[changeKey] as any) = state[
										changeKey
									] as any;
								}

								boardUpdateMap[changeKey] = Date.now();
								boardLastUpdateMap.set(board, boardUpdateMap);
							}

							const commands: string[] = [];

							// Say we're going to be sending something and wait for the marker
							if (boardChanges.playState !== undefined) {
								commands.push(
									`bp${boardChanges.playState ? '1' : '0'}`
								);
							}
							if (boardChanges.playStart !== undefined) {
								// Start time is always in the past,
								// send NOW - start_time to get diff
								commands.push(
									`bs${Date.now() - boardChanges.playStart}`
								);
							}
							if (boardChanges.duration !== undefined) {
								commands.push(`bd${boardChanges.duration}`);
							}
							if (boardChanges.beats !== undefined) {
								const beatArr: number[] = [];
								const playbackTime = boardChanges.playbackTime;
								let beatChanges: SpotifyTypes.TimeInterval[] = boardChanges.beats!;
								if (
									boardChanges.beats.length >
									MAX_BEATS_ARR_LENGTH
								) {
									let index = 0;
									while (
										playbackTime >
											boardChanges.beats[index].start +
												boardChanges.beats[index]
													.duration &&
										index < boardChanges.beats.length
									) {
										index++;
									}
									beatChanges = boardChanges.beats.slice(
										index,
										index + MAX_BEATS_ARR_LENGTH
									);
								}
								beatChanges.forEach(
									({ start, confidence, duration }) => {
										beatArr.push(
											Math.round(start * 1000),
											Math.round(duration * 1000),
											Math.round(confidence * 100)
										);
									}
								);

								await board.primeForCommands();
								for (const command of commands) {
									await board.sendCommand(command, false);
								}
								await board.sendCommand(
									`bb${beatArr.length / 3} ${beatArr.join(
										','
									)}`,
									false
								);
								await board.cancelPrime();
							} else {
								for (const command of commands) {
									await board.sendCommand(command, true);
								}
							}
						})
				);
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
		export let explainHook: ExplainHook | null = null;

		export function initExplainHook(hook: ExplainHook) {
			explainHook = hook;
		}

		export async function init({
			app,
			randomNum,
			websocket
		}: ModuleConfig) {
			app.post('/rgb/color', async (req, res) => {
				await API.Handler.setColor(
					res,
					{
						...req.params,
						...req.body
					},
					`API.${req.url}`
				);
			});
			app.post('/rgb/color/:color/:instensity?', async (req, res) => {
				await API.Handler.setColor(
					res,
					{
						...req.params,
						...req.body
					},
					`API.${req.url}`
				);
			});
			app.post(
				'/rgb/color/:red/:green/:blue/:intensity?',
				async (req, res) => {
					await API.Handler.setRGB(
						res,
						{
							...req.params,
							...req.body
						},
						`API.${req.url}`
					);
				}
			);
			app.post('/rgb/power/:power', async (req, res) => {
				await API.Handler.setPower(
					res,
					{
						...req.params,
						...req.body
					},
					`API.${req.url}`
				);
			});
			app.post(
				'/rgb/pattern/:pattern/:speed?/:transition?',
				async (req, res) => {
					await API.Handler.runPattern(
						res,
						{
							...req.params,
							...req.body
						},
						`API.${req.url}`
					);
				}
			);
			app.post('/rgb/effect/:effect', async (req, res) => {
				await API.Handler.runEffect(
					res,
					{
						...req.params,
						...req.body
					},
					`API.${req.url}`
				);
			});
			app.all('/rgb/refresh', async (_req, res) => {
				await API.Handler.refresh(res);
			});
			app.all('/rgb', async (req, res) => {
				await WebPage.Handler.index(res, req, randomNum);
			});

			websocket.all('/music_visualize', async ({ addListener }) => {
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

	async function switchLed(name: LED_NAMES, value: string, logObj: any) {
		const client = Clients.getLed(name);
		if (!client) return;
		if (value === '1') {
			attachMessage(
				attachSourcedMessage(
					logObj,
					'keyval listener',
					Routing.explainHook,
					`Setting`,
					chalk.bold(client.address),
					`to color rgb(255, 255, 255)`
				),
				chalk.bgHex(API.colorToHex(NIGHTSTAND_COLOR))('   ')
			);
			if (Routing.explainHook) {
				Routing.explainHook(
					`Set rgb ${name} to white`,
					'keyval listener',
					logObj
				);
			}
			return client.setColor(255, 255, 255);
		} else if (value === '0') {
			attachSourcedMessage(
				logObj,
				'keyval listener',
				Routing.explainHook,
				`Turned off`,
				chalk.bold(client.address)
			);
			return client.turnOff();
		}
		return Promise.resolve();
	}

	let wakelights: NodeJS.Timeout[] = [];
	function cancelActiveWakelights() {
		wakelights.forEach(timer => clearInterval(timer));
		wakelights = [];
	}

	function initListeners() {
		KeyVal.GetSetListener.addListener(
			'room.lights.nightstand',
			async (value, logObj) => {
				cancelActiveWakelights();

				const client = Clients.getLed(LED_NAMES.BED_LEDS);
				if (!client) return;
				if (value === '1') {
					attachMessage(
						attachSourcedMessage(
							logObj,
							'keyval listener',
							Routing.explainHook,
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
					attachSourcedMessage(
						logObj,
						'keyval listener',
						Routing.explainHook,
						`Turned off`,
						chalk.bold(client.address)
					);
					return client.turnOff();
				}
				return Promise.resolve();
			}
		);

		KeyVal.GetSetListener.addListener(
			'room.leds.wakelight',
			async (value, logObj) => {
				cancelActiveWakelights();

				const client = Clients.getLed(LED_NAMES.BED_LEDS);
				if (!client) return;
				if (value === '1') {
					attachMessage(
						attachSourcedMessage(
							logObj,
							'keyval listener',
							Routing.explainHook,
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
							wakelights.splice(wakelights.indexOf(interval), 1);
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
					cancelActiveWakelights();
					attachSourcedMessage(
						logObj,
						'keyval listener',
						Routing.explainHook,
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
	}
}
