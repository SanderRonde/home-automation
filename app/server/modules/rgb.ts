import {
	LED_NAMES,
	NIGHTSTAND_COLOR,
	LED_DEVICE_NAME,
	MAGIC_LEDS,
	ARDUINO_LEDS,
	LED_IPS,
	WAKELIGHT_TIME,
	NAME_MAP,
	MARKED_AUDIO_FOLDER,
	NUM_LEDS
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
import { ModuleConfig, AllModules } from './modules';
import { Color, IColor } from '../lib/types';
import { wait, arrToObj } from '../lib/util';
import { BotState } from '../lib/bot-state';
import SerialPort = require('serialport');
import { ExplainHook } from './explain';
import { colorList } from '../lib/data';
import { ResponseLike } from './multi';
import { exec } from 'child_process';
import { ModuleMeta } from './meta';
import { Bot as _Bot } from './bot';
import * as express from 'express';
import { KeyVal } from './keyval';
import { Auth } from './auth';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

function getIntensityPercentage(percentage: number) {
	return Math.round((percentage / 100) * 255);
}

function restartSelf() {
	return new Promise(resolve => {
		// Restart this program
		exec(
			`sudo -u root su -c "zsh -c \\"source /root/.zshrc ; forever restart automation\\""`,
			(err, _stdout, stderr) => {
				if (err) {
					console.log('Failed to restart :(', stderr);
					resolve();
					return;
				}
				resolve();
			}
		);
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

		async notifyModules(modules: AllModules) {
			MarkedAudio.setModules(modules);
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

	export namespace EffectConfig {
		const BYTE_BITS = 8;
		const MAX_BYTE_VAL = Math.pow(2, BYTE_BITS) - 1;

		export enum MOVING_STATUS {
			OFF = 0,
			FORWARDS = 1,
			BACKWARDS = 2
		}

		function flatten<V>(arr: V[][]): V[] {
			const resultArr: V[] = [];
			for (const value of arr) {
				resultArr.push(...value);
			}
			return resultArr;
		}

		function assert(condition: boolean, message: string) {
			if (!condition) {
				throw new Error(message);
			}
		}

		function shortToBytes(short: number) {
			return [
				(short & (MAX_BYTE_VAL << BYTE_BITS)) >> BYTE_BITS,
				short & MAX_BYTE_VAL
			];
		}

		export class Leds {
			private _leds!: (ColorSequence | SingleColor)[];

			constructor(private _numLeds: number) {}

			private _assertTotalLeds() {
				assert(
					this._leds.reduce((prev, current) => {
						return prev + current.length;
					}, 0) <= this._numLeds,
					'Number of LEDs exceeds total'
				);
				assert(
					this._leds.reduce((prev, current) => {
						return prev + current.length;
					}, 0) >= this._numLeds,
					'Number of LEDs is lower than total'
				);
			}

			fillWithColors(colors: Color[]) {
				const numFullSequences = Math.floor(
					this._numLeds / colors.length
				);
				this._leds = [];
				this._leds.push(new ColorSequence(colors, numFullSequences));
				if (numFullSequences * colors.length !== this._numLeds) {
					const remainingColors =
						this._numLeds - numFullSequences * colors.length;
					for (let i = 0; i < remainingColors; i++) {
						this._leds.push(new SingleColor(colors[i]));
					}
				}

				this._assertTotalLeds();

				return this;
			}

			toSequence() {
				return this._leds;
			}
		}

		export class MoveData {
			static readonly MOVING_STATUS = MOVING_STATUS;

			constructor(
				_moving: MOVING_STATUS.BACKWARDS | MOVING_STATUS.FORWARDS,
				_movingConfig: {
					jumpSize: number;
					jumpDelay: number;
				},
				_alternateConfig?:
					| {
							alternate: true;
							alternateDelay: number;
					  }
					| {
							alternate: false;
					  }
			);
			constructor(_moving: MOVING_STATUS.OFF);
			constructor(
				private _moving: MOVING_STATUS,
				private _movingConfig: {
					jumpSize: number;
					jumpDelay: number;
				} = {
					jumpSize: 0,
					jumpDelay: 0
				},
				private _alternateConfig:
					| {
							alternate: true;
							alternateDelay: number;
					  }
					| {
							alternate: false;
					  } = {
					alternate: false
				}
			) {}

			toBytes() {
				return [
					this._moving,
					...shortToBytes(this._movingConfig.jumpSize),
					...shortToBytes(this._movingConfig.jumpDelay),
					~~this._alternateConfig.alternate,
					...shortToBytes(
						this._alternateConfig.alternate
							? this._alternateConfig.alternateDelay
							: 0
					)
				];
			}
		}

		export class ColorSequence {
			public colors: Color[];

			constructor(colors: Color[] | Color, public repetitions: number) {
				this.colors = Array.isArray(colors) ? colors : [colors];
			}

			toBytes(): number[] {
				return [
					ColorType.COLOR_SEQUENCE,
					...shortToBytes(this.colors.length),
					...shortToBytes(this.repetitions),
					...flatten(this.colors.map(color => color.toBytes()))
				];
			}

			get length() {
				return (
					(Array.isArray(this.colors) ? this.colors.length : 1) *
					this.repetitions
				);
			}
		}

		export class TransparentSequence {
			constructor(public length: number) {}

			toBytes(): number[] {
				return [ColorType.TRANSPARENT, ...shortToBytes(this.length)];
			}
		}

		export enum ColorType {
			SINGLE_COLOR = 0,
			COLOR_SEQUENCE = 1,
			RANDOM_COLOR = 2,
			TRANSPARENT = 3,
			REPEAT = 4
		}

		export class SingleColor {
			constructor(public color: Color) {}

			toBytes() {
				return [ColorType.SINGLE_COLOR, ...this.color.toBytes()];
			}

			get length() {
				return 1;
			}
		}

		export class RandomColor {
			constructor(
				public size: number,
				public randomTime: number,
				public randomEveryTime: boolean
			) {}

			toBytes() {
				return [
					ColorType.RANDOM_COLOR,
					~~this.randomEveryTime,
					...shortToBytes(this.randomTime),
					...shortToBytes(this.size)
				];
			}
		}

		export class Repeat {
			constructor(
				public repetitions: number,
				public sequence:
					| SingleColor
					| ColorSequence
					| RandomColor
					| TransparentSequence
			) {}

			toBytes() {
				return [
					ColorType.REPEAT,
					...shortToBytes(this.repetitions),
					...this.sequence.toBytes()
				];
			}
		}

		export class LedSpecStep {
			public moveData: MoveData;
			public background: Color;
			public sequences: (
				| SingleColor
				| ColorSequence
				| RandomColor
				| TransparentSequence
				| Repeat
			)[];

			constructor(
				{
					background,
					moveData,
					sequences
				}: {
					moveData: MoveData;
					background: Color;
					sequences: (
						| SingleColor
						| ColorSequence
						| RandomColor
						| Repeat
						| TransparentSequence
					)[];
				},
				public delayUntilNext: number = 0
			) {
				this.moveData = moveData;
				this.background = background;
				this.sequences = sequences;
			}

			toBytes() {
				return [
					...shortToBytes(this.delayUntilNext),
					...this.moveData.toBytes(),
					...this.background.toBytes(),
					...shortToBytes(
						this.sequences
							.map(sequence => {
								if (sequence instanceof Repeat) {
									return sequence.repetitions;
								}
								return 1;
							})
							.reduce((p, c) => p + c, 0)
					),
					...flatten(
						this.sequences.map(sequence => sequence.toBytes())
					)
				];
			}
		}

		export class LedEffect {
			constructor(public effect: LedSpecStep[]) {}

			toBytes() {
				debugger;
				return [
					...shortToBytes(this.effect.length),
					...flatten(
						this.effect.map(step => {
							return step.toBytes();
						})
					)
				];
			}
		}

		export class LedSpec {
			constructor(public steps: LedEffect) {}

			toBytes(): number[] {
				return [
					'<'.charCodeAt(0),
					...this.steps.toBytes(),
					'>'.charCodeAt(0)
				];
			}
		}
	}

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
				_intensity?: number,
				callback?: (err: Error | null, success: boolean) => void
			): Promise<boolean> {
				await this._turnedOn();
				this.board.setSolid({
					r: red,
					g: green,
					b: blue
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
				this.board.setSolid({ r: red, g: green, b: blue });
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
				this.board.setSolid({
					r: red * brightnessScale,
					g: green * brightnessScale,
					b: blue * brightnessScale
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
				this.board.setSolid(new Color(ww));
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

		export interface Marked {
			color: Color;
			startTime: number;
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
			  }
			| {
					type: 'marked';
					data: Marked;
			  };

		export type JoinedConfigs = Partial<
			Solid & Dot & Split & Pattern & Flash
		>;

		export type Effects = keyof typeof arduinoEffects;

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

		function HSVtoRGB(h: number, s: number, v: number) {
			let r: number;
			let g: number;
			let b: number;

			let i, f, p, q, t;
			i = Math.floor(h * 6);
			f = h * 6 - i;
			p = v * (1 - s);
			q = v * (1 - f * s);
			t = v * (1 - (1 - f) * s);
			switch (i % 6) {
				case 0:
					(r = v), (g = t), (b = p);
					break;
				case 1:
					(r = q), (g = v), (b = p);
					break;
				case 2:
					(r = p), (g = v), (b = t);
					break;
				case 3:
					(r = p), (g = q), (b = v);
					break;
				case 4:
					(r = t), (g = p), (b = v);
					break;
				case 5:
					(r = v), (g = p), (b = q);
					break;
			}
			return {
				r: Math.round(r! * 255),
				g: Math.round(g! * 255),
				b: Math.round(b! * 255)
			};
		}

		function flatten<V>(arr: V[][]): V[] {
			const flattened: V[] = [];
			for (const value of arr) {
				flattened.push(...value);
			}
			return flattened;
		}

		function getRandomColor() {
			const h = Math.round(Math.random() * 255);
			const { b, g, r } = HSVtoRGB(h, 255, 255);
			return new Color(r, g, b);
		}

		export const arduinoEffects = {
			rainbow: {
				description: 'Forwards moving rainbow pattern',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.FORWARDS,
							{
								jumpSize: 1,
								jumpDelay: 1
							}
						),
						background: new Color(0, 0, 0),
						sequences: new EffectConfig.Leds(NUM_LEDS)
							.fillWithColors([
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
							])
							.toSequence()
					})
				])
			},
			rainbow2: {
				description: 'Slightly bigger block size rainbow',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.FORWARDS,
							{
								jumpSize: 1,
								jumpDelay: 1
							}
						),
						background: new Color(0, 0, 0),
						sequences: new EffectConfig.Leds(NUM_LEDS)
							.fillWithColors([
								...interpolate(
									new Color(255, 0, 0),
									new Color(0, 255, 0),
									15,
									{ end: false }
								),
								...interpolate(
									new Color(0, 255, 0),
									new Color(0, 0, 255),
									15,
									{ end: false }
								),
								...interpolate(
									new Color(0, 0, 255),
									new Color(255, 0, 0),
									15,
									{ end: false }
								)
							])
							.toSequence()
					})
				])
			},
			reddot: {
				description: 'Single red dot moving',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.FORWARDS,
							{
								jumpSize: 1,
								jumpDelay: 1
							}
						),
						background: new Color(0, 0, 0),
						sequences: [
							new EffectConfig.ColorSequence(
								new Color(255, 0, 0),
								5
							)
						]
					})
				])
			},
			multidot: {
				description: 'A bunch of dots moving',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.FORWARDS,
							{
								jumpSize: 1,
								jumpDelay: 1
							}
						),
						background: new Color(0, 0, 0),
						sequences: [
							new EffectConfig.ColorSequence(
								new Color(255, 0, 0),
								1
							),
							new EffectConfig.TransparentSequence(11),
							new EffectConfig.ColorSequence(
								new Color(255, 0, 0),
								1
							),
							new EffectConfig.TransparentSequence(11),
							new EffectConfig.ColorSequence(
								new Color(255, 0, 0),
								1
							),
							new EffectConfig.TransparentSequence(11),
							new EffectConfig.ColorSequence(
								new Color(255, 0, 0),
								1
							),
							new EffectConfig.TransparentSequence(11),
							new EffectConfig.ColorSequence(
								new Color(255, 0, 0),
								1
							),
							new EffectConfig.TransparentSequence(11)
						]
					})
				])
			},

			reddotbluebg: {
				description: 'A red dot moving on a blue background',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.FORWARDS,
							{
								jumpSize: 1,
								jumpDelay: 1
							}
						),
						background: new Color(0, 0, 255),
						sequences: [
							new EffectConfig.ColorSequence(
								new Color(255, 0, 0),
								5
							)
						]
					})
				])
			},
			split: {
				description: 'A bunch of moving chunks of colors',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.FORWARDS,
							{
								jumpSize: 1,
								jumpDelay: 1
							}
						),
						background: new Color(0, 0, 0),
						sequences: [
							new EffectConfig.ColorSequence(
								new Color(0, 0, 255),
								NUM_LEDS / 4
							),
							new EffectConfig.ColorSequence(
								new Color(255, 0, 0),
								NUM_LEDS / 4
							),
							new EffectConfig.ColorSequence(
								new Color(255, 0, 255),
								NUM_LEDS / 4
							),
							new EffectConfig.ColorSequence(
								new Color(0, 255, 0),
								NUM_LEDS / 4
							)
						]
					})
				])
			},
			rgb: {
				description: 'Red green and blue dots moving in a pattern',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.FORWARDS,
							{
								jumpSize: 1,
								jumpDelay: 1
							}
						),
						background: new Color(0, 0, 0),
						sequences: new EffectConfig.Leds(NUM_LEDS)
							.fillWithColors([
								new Color(255, 0, 0),
								new Color(0, 255, 0),
								new Color(0, 0, 255)
							])
							.toSequence()
					})
				])
			},
			quickstrobe: {
				description: 'A very fast strobe',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep(
						{
							moveData: new EffectConfig.MoveData(
								EffectConfig.MOVING_STATUS.OFF
							),
							background: new Color(0, 0, 0),
							sequences: []
						},
						1
					),
					new EffectConfig.LedSpecStep(
						{
							moveData: new EffectConfig.MoveData(
								EffectConfig.MOVING_STATUS.OFF
							),
							background: new Color(255, 255, 255),
							sequences: []
						},
						1
					)
				])
			},
			strobe: {
				description: 'A bunch of moving chunks of colors',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep(
						{
							moveData: new EffectConfig.MoveData(
								EffectConfig.MOVING_STATUS.OFF
							),
							background: new Color(0, 0, 0),
							sequences: []
						},
						60
					),
					new EffectConfig.LedSpecStep(
						{
							moveData: new EffectConfig.MoveData(
								EffectConfig.MOVING_STATUS.OFF
							),
							background: new Color(255, 255, 255),
							sequences: []
						},
						60
					)
				])
			},
			slowstrobe: {
				description: 'A slow strobe',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep(
						{
							moveData: new EffectConfig.MoveData(
								EffectConfig.MOVING_STATUS.OFF
							),
							background: new Color(0, 0, 0),
							sequences: []
						},
						500
					),
					new EffectConfig.LedSpecStep(
						{
							moveData: new EffectConfig.MoveData(
								EffectConfig.MOVING_STATUS.OFF
							),
							background: new Color(255, 255, 255),
							sequences: []
						},
						500
					)
				])
			},
			epileptisch: {
				description: 'A superfast flash',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.OFF
						),
						background: new Color(255, 0, 0),
						sequences: []
					}),
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.OFF
						),
						background: new Color(0, 255, 0),
						sequences: []
					}),
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.OFF
						),
						background: new Color(0, 0, 255),
						sequences: []
					})
				]),
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
			fade: {
				description: 'A fading rainbow',
				effect: new EffectConfig.LedEffect(
					[
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
					].map(
						color =>
							new EffectConfig.LedSpecStep({
								moveData: new EffectConfig.MoveData(
									EffectConfig.MOVING_STATUS.OFF
								),
								background: color,
								sequences: []
							})
					)
				)
			},
			desk: {
				description: 'An illumination of just my desk',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.OFF
						),
						background: new Color(0, 0, 0),
						sequences: [
							new EffectConfig.ColorSequence(
								new Color(255, 255, 255),
								75
							),
							new EffectConfig.TransparentSequence(550),
							new EffectConfig.ColorSequence(
								new Color(255, 255, 255),
								275
							)
						]
					})
				])
			},
			randomslow: {
				description: 'A slow flash of random colors of block size 1',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.OFF
						),
						background: new Color(0, 0, 0),
						sequences: [
							new EffectConfig.Repeat(
								NUM_LEDS,
								new EffectConfig.RandomColor(1, 1000, true)
							)
						]
					})
				])
			},
			randomslowbig: {
				description: 'A slow flash of random colors of block size 10',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.OFF
						),
						background: new Color(0, 0, 0),
						sequences: [
							new EffectConfig.Repeat(
								NUM_LEDS / 10,
								new EffectConfig.RandomColor(10, 1000, true)
							)
						]
					})
				])
			},
			randomblocks: {
				description: 'A fast flash of big chunks of random colors',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.OFF
						),
						background: new Color(0, 0, 0),
						sequences: [
							new EffectConfig.Repeat(
								NUM_LEDS / 20,
								new EffectConfig.RandomColor(20, 1, true)
							)
						]
					})
				])
			},
			randomfast: {
				description: 'A fast flash of random colors of block size 1',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.OFF
						),
						background: new Color(0, 0, 0),
						sequences: [
							new EffectConfig.Repeat(
								NUM_LEDS,
								new EffectConfig.RandomColor(1, 1, true)
							)
						]
					})
				])
			},
			randomparty: {
				description: 'Big slow chunks',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.OFF
						),
						background: new Color(0, 0, 0),
						sequences: [
							new EffectConfig.Repeat(
								NUM_LEDS / 75,
								new EffectConfig.RandomColor(75, 150, true)
							)
						]
					})
				])
			},
			randomfull: {
				description: 'A single random color updating slowly',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.OFF
						),
						background: new Color(0, 0, 0),
						sequences: [
							new EffectConfig.RandomColor(NUM_LEDS, 1000, true)
						]
					})
				])
			},
			randomfullfast: {
				description: 'A single random color updating quickly',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.OFF
						),
						background: new Color(0, 0, 0),
						sequences: [
							new EffectConfig.RandomColor(NUM_LEDS, 1, true)
						]
					})
				])
			},
			shrinkingreddots: {
				description: 'Shrinking red dots',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.FORWARDS,
							{
								jumpDelay: 1,
								jumpSize: 1
							}
						),
						background: new Color(0, 0, 0),
						sequences: new EffectConfig.Leds(NUM_LEDS)
							.fillWithColors(
								interpolate(
									new Color(0, 0, 0),
									new Color(255, 0, 0),
									5,
									{
										start: true,
										end: true
									}
								)
							)
							.toSequence()
					})
				])
			},
			shrinkingmulticolor: {
				description: 'Shrinking dots of multiple colors',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.FORWARDS,
							{
								jumpDelay: 1,
								jumpSize: 1
							}
						),
						background: new Color(0, 0, 0),
						sequences: flatten(
							new Array(90).fill('').map(() =>
								interpolate(
									new Color(0, 0, 0),
									getRandomColor(),
									10,
									{
										start: true,
										end: true
									}
								).map(
									color => new EffectConfig.SingleColor(color)
								)
							)
						)
					})
				])
			},
			shrinkingrainbows: {
				description: 'Shrinking rainbows',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.FORWARDS,
							{
								jumpDelay: 1,
								jumpSize: 1
							}
						),
						background: new Color(0, 0, 0),
						sequences: new EffectConfig.Leds(NUM_LEDS)
							.fillWithColors([
								new Color(0, 0, 0),
								new Color(19, 0, 26),
								new Color(19, 0, 33),
								new Color(0, 0, 96),
								new Color(0, 128, 0),
								new Color(160, 160, 0),
								new Color(191, 96, 0),
								new Color(255, 0, 0)
							])
							.toSequence()
					})
				])
			},
			wiebel: {
				description: 'Wiebelend ding',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.FORWARDS,
							{
								jumpDelay: 1,
								jumpSize: 1
							}
						),
						background: new Color(0, 0, 0),
						sequences: new EffectConfig.Leds(NUM_LEDS)
							.fillWithColors([
								new Color(0, 255, 0),
								new Color(0, 0, 255)
							])
							.toSequence()
					})
				])
			}
		};
		const typeCheck = arduinoEffects as {
			[key: string]: {
				effect: EffectConfig.LedEffect;
				description: string;
			};
		};
		// @ts-ignore
		typeCheck;
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
							return c.board.runEffect(effect.effect);
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
					type: 'markedAudio';
					file: string;
					helpers: Pick<
						BotState.MatchHandlerParams,
						'ask' | 'sendText' | 'askCancelable'
					>;
			  }
		) & {
			logObj: any;
			resolver: (value: any) => void;
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
								auth: Auth.Secret.getKey()
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
								auth: Auth.Secret.getKey()
							},
							source
						);
					}
				} else if (request.type == 'power') {
					value = await API.Handler.setPower(
						resDummy,
						{
							power: request.state,
							auth: Auth.Secret.getKey()
						},
						source
					);
				} else if (request.type === 'effect') {
					value = await API.Handler.runEffect(
						resDummy,
						{
							effect: request.name,
							auth: Auth.Secret.getKey(),
							...request.extra
						},
						source
					);
				} else if (request.type === 'markedAudio') {
					value = await MarkedAudio.play(
						request.file,
						logObj,
						request.helpers
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

			async markedAudio(
				file: string,
				helpers: Pick<
					BotState.MatchHandlerParams,
					'ask' | 'sendText' | 'askCancelable'
				>
			): ReturnType<typeof MarkedAudio.play> {
				return new Promise<ReturnType<typeof MarkedAudio.play>>(
					resolve => {
						const req: ExternalRequest = {
							type: 'markedAudio',
							file,
							helpers,
							logObj: this._logObj,
							resolver: resolve,
							source: this._source
						};
						if (Handler._ready) {
							Handler._handleRequest(req);
						} else {
							Handler._requests.push(req);
						}
					}
				);
			}
		}
	}

	export namespace Bot {
		export interface JSON {}

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
				'/restart': 'Restart the server',
				'/marked': 'Play marked audio file',
				...arrToObj(
					Object.keys(ArduinoAPI.arduinoEffects).map(key => {
						const value =
							ArduinoAPI.arduinoEffects[
								key as ArduinoAPI.Effects
							];
						return [
							`/effect${key}`,
							`Effect. ${value.description}`
						];
					})
				)
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
					mm('/rgbon', async ({ logObj, matchText }) => {
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
					mm('/rgboff', async ({ logObj, matchText }) => {
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
						async ({ logObj, match, matchText }) => {
							const targetState = match[1];
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
						/turn (on|off) (desk|couch|wall|bed)/,
						async ({ logObj, match }) => {
							const targetState = match[1];
							const ledName = getLedFromName(match[2])!;
							const client = Clients.getLed(ledName);
							if (!client) {
								return 'Failed to find client';
							}

							if (targetState === 'on') {
								attachMessage(logObj, 'Turned it on');
								client.turnOn();
								return 'Turned it on';
							} else {
								attachMessage(logObj, 'Turned it off');
								client.turnOff();
								return 'Turned it off';
							}
						}
					);
					mm(
						'/arduinooff',
						/turn (on|off) (ceiling|arduino|duino)/,
						async ({ logObj, match }) => {
							const targetState =
								match.length === 0 ? 'off' : match[1];
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
						async ({ logObj, match, matchText }) => {
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
						/\/effect((\w{2,})|[^s])/,
						async ({ logObj, match, matchText }) => {
							const effectName = match[1] as ArduinoAPI.Effects;
							if (!(effectName in ArduinoAPI.arduinoEffects)) {
								return `Effect "${effectName}" does not exist`;
							}

							if (
								await new External.Handler(
									logObj,
									`BOT.${matchText}`
								).effect(effectName, {})
							) {
								return `Started effect "${effectName}" with config ${JSON.stringify(
									ArduinoAPI.arduinoEffects[effectName]
								)}`;
							} else {
								return 'Failed to start effect';
							}
						}
					);
					mm(
						'/effects',
						/what effects are there(\?)?/,
						async ({ logObj, match, matchText }) => {
							if (match && match[1]) {
								const effectName = `s${match[1]}` as ArduinoAPI.Effects;
								if (
									!(effectName in ArduinoAPI.arduinoEffects)
								) {
									return `Effect "${effectName}" does not exist`;
								}

								if (
									await new External.Handler(
										logObj,
										`BOT.${matchText}`
									).effect(effectName, {})
								) {
									return `Started effect "${effectName}" with config ${JSON.stringify(
										ArduinoAPI.arduinoEffects[effectName]
									)}`;
								} else {
									return 'Failed to start effect';
								}
							}

							return `Effects are:\n${Object.keys(
								ArduinoAPI.arduinoEffects
							)
								.map(key => {
									const value =
										ArduinoAPI.arduinoEffects[
											key as ArduinoAPI.Effects
										];
									return `/effect${key} - ${value.description}`;
								})
								.join('\n')}`;
						}
					);
					mm('/refresh', /refresh (rgb|led)/, async ({ logObj }) => {
						return `Found ${await Scan.scanRGBControllers(
							false,
							logObj
						)} RGB controllers`;
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
					mm(
						/\/marked ([^ ]+)/,
						async ({
							logObj,
							match,
							ask,
							sendText,
							askCancelable
						}) => {
							const file = match[1] as string;
							const {
								message,
								success
							} = await new External.Handler(
								logObj,
								'BOT.marked'
							).markedAudio(file, {
								ask,
								sendText,
								askCancelable
							});

							if (success) {
								return message || 'Playing!';
							}
							return message!;
						}
					);
				}
			);

			constructor(_json?: JSON) {
				super();
			}

			public lastConfig:
				| (ArduinoAPI.ArduinoConfig & {
						data?: ArduinoAPI.JoinedConfigs;
				  })
				| null = null;

			static async match(
				config: _Bot.Message.MatchParameters
			): Promise<_Bot.Message.MatchResponse | undefined> {
				return await this.matchLines({
					...config,
					matchConfig: Bot.matches
				});
			}

			toJSON(): JSON {
				return {};
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

		function rgbHTML(randomNum: number) {
			return `<html style="background-color: rgb(70,70,70);">
				<head>
					<link rel="icon" href="/rgb/favicon.ico" type="image/x-icon" />
					<link rel="manifest" href="/rgb/static/manifest.json">
					<meta name="viewport" content="width=device-width, initial-scale=1">
					<title>RGB controller</title>
				</head>
				<body style="margin: 0">
					<rgb-controller key="${Auth.Secret.getKey()}" patterns='${patternPreviews}'></rgb-controller>
					<script type="module" src="/rgb/rgb.bundle.js?n=${randomNum}"></script>
				</body>
			</html>`;
		}

		export class Handler {
			@errorHandle
			@authCookie
			@upgradeToHTTPS
			public static index(
				res: ResponseLike,
				_req: express.Request,
				randomNum: number
			) {
				res.status(200);
				res.contentType('.html');
				res.write(rgbHTML(randomNum));
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
				setTimeout(() => {
					resolve(null);
				}, 1000 * 60);

				const port = new SerialPort(LED_DEVICE_NAME, {
					baudRate: 115200
				});

				let err: boolean = false;
				port.on('error', e => {
					console.log('immediately got an error', e);
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

				if (err) {
					resolve(null);
					return;
				}

				// Get LEDS
				setTimeout(() => {
					port.write('leds\n');
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
							log(
								getTime(),
								chalk.cyan(`[${LED_DEVICE_NAME}] <-`),
								`# ${line.toString()}`
							);
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
				this._port.addListener('data', chunk => {
					log(
						getTime(),
						chalk.cyan(`[${this.name}] ->`),
						`${chunk.toString()}`
					);
				});
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
				this.setListener(() => {});
			}

			public writeString(data: string): string {
				this._port.write(data);
				return data;
			}

			public async runEffect(
				effect: EffectConfig.LedEffect
			): Promise<number[]> {
				return new Promise(resolve => {
					let responded: boolean = false;
					const listener = (chunk: string | Buffer) => {
						if (!responded && chunk.toString().includes('ready')) {
							responded = true;
							this._port.removeListener('data', listener);
							const bytes = new EffectConfig.LedSpec(
								effect
							).toBytes();
							this._port.write(bytes);
							log(
								getTime(),
								chalk.cyan(`[${this.name}] <-`),
								`${bytes}`
							);
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

			public setSolid({ r, g, b }: { r: number; g: number; b: number }) {
				return this.runEffect(
					new EffectConfig.LedEffect([
						new EffectConfig.LedSpecStep({
							moveData: new EffectConfig.MoveData(
								EffectConfig.MOVING_STATUS.OFF
							),
							background: new Color(r, g, b),
							sequences: []
						})
					])
				);
			}

			public setModeOff(): string {
				return this.writeString('off');
			}

			public getLeds(): string {
				return this.writeString('leds');
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

	export namespace MarkedAudio {
		let modules: AllModules | null = null;

		export function setModules(passedModules: AllModules) {
			modules = passedModules;
		}

		interface ParsedMarked {
			'spotify-uri': string;
			color: IColor;
			offset?: number;
			items: {
				type: 'melody';
				time: number;
				duration: number;
			}[];
		}

		async function getData(
			name: string,
			logObj: any
		): Promise<
			| { success: true; message: string | null }
			| { success: false; message: string }
			| ParsedMarked
		> {
			// Find the file first
			const filePath = path.join(MARKED_AUDIO_FOLDER, `${name}.json`);
			if (!(await fs.pathExists(filePath))) {
				return {
					success: false,
					message: 'File does not exist'
				};
			}

			// Read it
			const file = await fs.readFile(filePath, {
				encoding: 'utf8'
			});

			// Parse it
			let parsed: ParsedMarked | null = null;
			try {
				parsed = JSON.parse(file);
			} catch (e) {
				return {
					success: false,
					message: 'Failed to parse file'
				};
			}

			// Try and authenticate
			const authenticated = await new modules!.spotifyBeats.External.Handler(
				logObj
			).test();
			if (!authenticated) {
				return {
					success: false,
					message: 'Unauthenticated'
				};
			}

			return parsed!;
		}

		async function startPlay(
			logObj: any,
			helpers: Pick<BotState.MatchHandlerParams, 'ask' | 'sendText'>,
			parsed: ParsedMarked
		): Promise<
			| { success: true; message: string | null }
			| { success: false; message: string }
			| null
		> {
			// Get devices
			const devices = await new modules!.spotifyBeats.External.Handler(
				logObj
			).getDevices();

			const devicesParsed = devices && (await devices.json());

			if (
				!devices ||
				!devicesParsed ||
				devicesParsed.devices.length === 0
			) {
				return {
					success: false,
					message: 'Failed to find devices'
				};
			}

			// Ask user what device to use
			const response = await helpers.ask(
				`On what device do you want to play? Type the name to choose and type "cancel" to cancel.\n${devicesParsed.devices.map(
					device => {
						return device.name;
					}
				)}`
			);
			if (!response || response.toLowerCase() === 'cancel') {
				return {
					success: true,
					message: 'Canceled by user'
				};
			}

			// Get chosen device
			const chosen = devicesParsed.devices.find(
				d => d.name.toLowerCase() === response!.toLowerCase()
			);

			if (!chosen) {
				return {
					success: false,
					message: 'Unknown device'
				};
			}

			// Play
			const playResponse = await new modules!.spotifyBeats.External.Handler(
				logObj
			).play(parsed!['spotify-uri'], chosen.id);

			if (
				!playResponse ||
				playResponse.status >= 300 ||
				playResponse.status < 200
			) {
				return {
					success: false,
					message: 'Failed to play'
				};
			}

			return null;
		}

		export async function play(
			name: string,
			logObj: any,
			helpers: Pick<
				BotState.MatchHandlerParams,
				'ask' | 'sendText' | 'askCancelable'
			>
		): Promise<
			| { success: true; message: string | null }
			| { success: false; message: string }
		> {
			// Parse data and make sure everything can run
			const parsed = await getData(name, logObj);
			if ('success' in parsed) {
				return parsed;
			}

			// Start playing the music
			const playing = await startPlay(logObj, helpers, parsed);
			if (playing !== null) {
				return playing;
			}

			await wait(1000 * 2);

			// Fetch playstate at this time, which should allow us to
			// calculate exactly when the song started playing
			const playState = await modules!.spotifyBeats.Spotify.API.getPlayState();
			if (!playState) {
				return {
					success: false,
					message: 'Failed to play'
				};
			}

			const playingTime =
				Date.now() - playState.playStart! + (parsed.offset ?? 0);

			let timeouts: NodeJS.Timeout[] = [];
			parsed.items.forEach(item => {
				timeouts.push(
					setTimeout(() => {
						Clients.arduinoClients.forEach(c =>
							c.setColor(
								parsed.color.r,
								parsed.color.g,
								parsed.color.b
							)
						);
						timeouts.push(
							setTimeout(() => {
								Clients.arduinoClients.forEach(c =>
									c.setColor(0, 0, 0)
								);
							}, Math.min(item.duration, 1) * 1000)
						);
					}, item.time * 1000 - playingTime)
				);
			});

			const { cancel, prom } = helpers.askCancelable(
				`Tell me when I need to stop by saying anything`
			);

			prom.then(async () => {
				timeouts.forEach(t => clearTimeout(t));
				await wait(1000);
				Clients.arduinoClients.forEach(c => c.setColor(0, 0, 0));

				await helpers.sendText('stopped');
			});

			const lastItem = parsed.items[parsed.items.length - 1];
			await wait(
				lastItem.time * 1000 - playingTime + lastItem.duration * 1000
			);

			cancel();

			return {
				success: true,
				message: 'Done playing'
			};
		}
	}

	export namespace Routing {
		export let explainHook: ExplainHook | null = null;

		export function initExplainHook(hook: ExplainHook) {
			explainHook = hook;
		}

		export async function init({ app, randomNum }: ModuleConfig) {
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
		}
	}

	function getLedFromName(name: string) {
		switch (name) {
			case 'desk':
				return LED_NAMES.DESK_LEDS;
			case 'couch':
				return LED_NAMES.COUCH_LEDS;
			case 'wall':
				return LED_NAMES.WALL_LEDS;
			case 'bed':
				return LED_NAMES.BED_LEDS;
		}
		return null;
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
				chalk.bgHex(API.colorToHex(new Color(255)))('   ')
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
		Object.entries({
			'room.leds.ceiling': LED_NAMES.CEILING_LEDS,
			'room.leds.bed': LED_NAMES.BED_LEDS,
			'room.leds.desk': LED_NAMES.DESK_LEDS,
			'room.leds.wall': LED_NAMES.WALL_LEDS,
			'room.leds.couch': LED_NAMES.COUCH_LEDS
		}).forEach(([key, ledName]) => {
			KeyVal.GetSetListener.addListener(key, async (value, logObj) => {
				await switchLed(ledName, value, logObj);
			});
		});
	}
}
