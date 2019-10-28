import { Discovery, Control, CustomMode, TransitionTypes, BuiltinPatterns } from 'magic-home';
import { errorHandle, requireParams, auth, authCookie } from '../lib/decorators';
import { attachMessage, ResDummy, getTime, log } from '../lib/logger';
import * as ReadLine from '@serialport/parser-readline';
import { BotState } from '../lib/bot-state';
import { AppWrapper } from '../lib/routes';
import SerialPort = require('serialport');
import { ResponseLike } from './multi';
import { WSWrapper } from '../lib/ws';
import { Bot as _Bot } from './bot';
import { Auth } from '../lib/auth';
import * as express from 'express';
import chalk from 'chalk';

function spedToMs(speed: number) {
	// TODO: fit this better
	return 1000 / speed;
}

export namespace RGB {
	export namespace Clients {
		abstract class RGBClient {
			static patternNames: {
				[key in BuiltinPatterns]: number;
			} = Control.patternNames;

			abstract setColor(red: number, green: number, blue: number, callback?: (err: Error|null, success: boolean) => void): Promise<boolean>;
			abstract setColorAndWarmWhite(red: number, green: number, blue: number, ww: number, callback?: (err: Error|null, success: boolean) => void): Promise<boolean>;
			abstract setColorWithBrightness(red: number, green: number, blue: number, brightness: number, callback?: (err: Error|null, success: boolean) => void): Promise<boolean>;
			abstract setCustomPattern(pattern: CustomMode, speed: number, callback?: () => void): Promise<boolean>;
			abstract setPattern(pattern: BuiltinPatterns, speed: number, callback?: () => void): Promise<boolean>;
			abstract setPower(on: boolean, callback?: () => void): Promise<boolean>;
			abstract setWarmWhite(ww: number, callback?: (err: Error|null, success: boolean) => void): Promise<boolean>;
			abstract turnOff(callback?: () => void): Promise<boolean>;
			abstract turnOn(callback?: () => void): Promise<boolean>;
		}

		export class MagicHomeClient extends RGBClient {
			constructor(private _control: Control) {
				super();
			}

			setColor(red: number, green: number, blue: number, callback?: (err: Error|null, success: boolean) => void): Promise<boolean> {
				return this._control.setColor(red, green, blue, callback);
			}
			setColorAndWarmWhite(red: number, green: number, blue: number, ww: number, callback?: (err: Error|null, success: boolean) => void): Promise<boolean> {
				return this._control.setColorAndWarmWhite(red, green, blue, ww, callback);
			}
			setColorWithBrightness(red: number, green: number, blue: number, brightness: number, callback?: (err: Error|null, success: boolean) => void): Promise<boolean> {
				return this._control.setColorWithBrightness(red, green, blue, brightness, callback);
			}
			setCustomPattern(pattern: CustomMode, speed: number, callback?: () => void): Promise<boolean> {
				return this._control.setCustomPattern(pattern, speed, callback);
			}
			setPattern(pattern: BuiltinPatterns, speed: number, callback?: () => void): Promise<boolean> {
				return this._control.setPattern(pattern, speed, callback);
			}
			setPower(on: boolean, callback?: () => void): Promise<boolean> {
				return this._control.setPower(on, callback);
			}
			setWarmWhite(ww: number, callback?: (err: Error|null, success: boolean) => void): Promise<boolean> {
				return this._control.setWarmWhite(ww, callback);
			}
			turnOff(callback?: () => void): Promise<boolean> {
				return this._control.turnOff(callback);
			}
			turnOn(callback?: () => void): Promise<boolean> {
				return this._control.turnOn(callback);
			}
		}

		export class ArduinoClient extends RGBClient {
			constructor(public board: Board.Board) {
				super();
			}

			public ping(): Promise<boolean> {
				return this.board.ping();
			}

			private _sendSuccess(callback?: (err: Error|null, success: boolean) => void) {
				callback && callback(null, true);
				return true;
			}

			async setColor(red: number, green: number, blue: number, callback?: (err: Error|null, success: boolean) => void): Promise<boolean> {
				this.board.setSolid({ r: red, g: green, b: blue });
				return this._sendSuccess(callback);
			}
			async setColorAndWarmWhite(red: number, green: number, blue: number, _ww: number, callback?: (err: Error|null, success: boolean) => void): Promise<boolean> {
				this.board.setSolid({ r: red, g: green, b: blue });
				return this._sendSuccess(callback);
			}
			async setColorWithBrightness(red: number, green: number, blue: number, brightness: number, callback?: (err: Error|null, success: boolean) => void): Promise<boolean> {
				const brightnessScale = brightness / 100;
				this.board.setSolid({ r: red * brightnessScale, g: green * brightnessScale, b: blue * brightnessScale });
				return this._sendSuccess(callback);
			}
			async setCustomPattern(pattern: CustomMode, speed: number, callback?: () => void): Promise<boolean> {
				this.board.setFlash({
					colors: pattern.colors.map(({ red, green, blue }) => ({ r: red, g: green, b: blue })),
					mode: pattern.transitionType,
					updateTime: spedToMs(speed)
				})
				return this._sendSuccess(callback);
			}
			async setPattern(_pattern: BuiltinPatterns, _speed: number, _callback?: () => void): Promise<boolean> {
				// Not implemented
				return Promise.resolve(true);
			}
			async setPower(on: boolean, callback?: () => void): Promise<boolean> {
				if (on) {
					return this.turnOn(callback);
				} else {
					return this.turnOff(callback);
				}
			}
			async setWarmWhite(ww: number, callback?: (err: Error|null, success: boolean) => void): Promise<boolean> {
				this.board.setSolid({ r: ww, g: ww, b: ww });
				return this._sendSuccess(callback);
			}
			async turnOff(callback?: () => void): Promise<boolean> {
				this.board.setModeOff();
				return this._sendSuccess(callback);
			}
			async turnOn(callback?: () => void): Promise<boolean> {
				return this._sendSuccess(callback);
			}
		}

		export let magicHomeClients: MagicHomeClient[] = [];
		export let arduinoClients: ArduinoClient[] = [];
		export let clients: RGBClient[] = [];
	}

	export namespace Scan {
		export async function scanMagicHomeControllers(first: boolean) {
			const scanTime = (first && process.argv.indexOf('--debug') > -1) ? 500 : 10000;
			const clients = (await new Discovery().scan(scanTime)).map((client) => {
				return new Control(client.address, {
					wait_for_reply: false
				});
			}).map(control => new Clients.MagicHomeClient(control));

			Clients.magicHomeClients = clients;
			Clients.clients = [
				...Clients.magicHomeClients,
				...Clients.arduinoClients
			];

			return clients.length;
		}

		export async function scanArduinos() {
			const pings = await Promise.all(Clients.arduinoClients.map(c => c.ping()));
			Clients.arduinoClients = Clients.arduinoClients.filter((_, i) => pings[i]);

			if (Clients.arduinoClients.length === 0) {
				const board = await Board.tryConnectRGBBoard();
				if (board) {
					Clients.arduinoClients.push(new Clients.ArduinoClient(board));
				}
			}

			Clients.clients = [
				...Clients.magicHomeClients,
				...Clients.arduinoClients
			];

			return Clients.arduinoClients.length;
		}

		export async function scanRGBControllers(first: boolean = false, logObj: any = undefined) {
			const [ magicHomeClients, arduinoClients] = await Promise.all([
				scanMagicHomeControllers(first),
				scanArduinos()
			]);
			const clients = magicHomeClients + arduinoClients;

			if (!logObj) {
				log(getTime(), chalk.cyan(`[rgb]`),
					'Found', chalk.bold(clients + ''), 'clients');
			} else {
				attachMessage(logObj, getTime(), chalk.cyan(`[rgb]`),
					'Found', chalk.bold(clients + ''), 'clients');
			}			
		}
	}

	type CustomPattern = 'rgb'|'rainbow'|'christmas'|'strobe'|'darkColors'|
		'shittyFire'|'betterFire';

	const patterns: Object & {
		[K in CustomPattern]: {
			pattern: CustomMode;
			defaultSpeed: number;
		}
	}= {
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
		darkColors: {
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
		shittyFire: {
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
		betterFire: {
			pattern: new CustomMode()
				.addColorList(new Array(15).fill('').map(() => {
					return [
						255 - (Math.random() * 90), 
						200 - (Math.random() * 200), 
						0
					] as [number, number, number];
				}))
				.setTransitionType('fade'),
			defaultSpeed: 100
		}
	}

	export namespace API {
		const HEX_REGEX = /#([a-fA-F\d]{2})([a-fA-F\d]{2})([a-fA-F\d]{2})/;
		function hexToRGB(hex: string) {
			const match = HEX_REGEX.exec(hex)!;

			const [ , r, g, b ] = match;
			return {
				r: parseInt(r, 16),
				g: parseInt(g, 16),
				b: parseInt(b, 16)
			}
		}
		
		export class Handler {
			@errorHandle
			@requireParams('color')
			@auth
			public static async setColor(res: ResponseLike, { color }: {
				color: string;
				auth?: string;
			}) {
				if (!(color in colorList)) return false;
				const hexColor = colorList[color as keyof typeof colorList];
				const { r, g, b } = hexToRGB(hexColor);

				attachMessage(attachMessage(attachMessage(res, `rgb(${r}, ${g}, ${b})`),
					chalk.bgHex(hexColor)('   ')), 
						`Updated ${Clients.clients!.length} clients`);
				

				await Promise.all(Clients.clients!.map(async (client) => {
					return Promise.all([
						client.setColorWithBrightness(r, g, b, 100),
						client.turnOn()
					]);
				}));

				res.status(200).end();
				return true;
			}

			private static _singleNumToHex(num: number) {
				if (num < 10) {
					return num + '';
				}
				return String.fromCharCode(97 + (num - 10));
			}

			static toHex(num: number) {
				return this._singleNumToHex(Math.floor(num / 16)) + this._singleNumToHex(num % 16);
			}

			@errorHandle
			@requireParams('red', 'green', 'blue')
			@auth
			public static async setRGB(res: ResponseLike, { red, green, blue }: {
				red: string;
				green: string;
				blue: string;
				auth?: string;
			}) {
				const redNum = Math.min(255, Math.max(0, parseInt(red, 10)));
				const greenNum = Math.min(255, Math.max(0, parseInt(green, 10)));
				const blueNum = Math.min(255, Math.max(0, parseInt(blue, 10)));
				attachMessage(attachMessage(attachMessage(res, `rgb(${red}, ${green}, ${blue})`),
					chalk.bgHex(`#${
						this.toHex(redNum)
					}${
						this.toHex(greenNum)
					}${
						this.toHex(blueNum)
					}`)('   ')), `Updated ${Clients.clients!.length} clients`);

				await Promise.all(Clients.clients!.map(async (client) => {
					return Promise.all([
						client.setColorWithBrightness(redNum, greenNum, blueNum, 100),
						client.turnOn()
					]);
				}));

				res.status(200).end();
			}

			@errorHandle
			@requireParams('power')
			@auth
			public static async setPower(res: ResponseLike, { power }: {
				power: string;
				auth?: string;
			}) {
				attachMessage(attachMessage(res, `Turned ${power}`),
					`Updated ${Clients.clients!.length} clients`);
				await Promise.all(Clients.clients!.map(c => power === 'on' ? c.turnOn() : c.turnOff()));
				res.status(200).end();
			}

			static overrideTransition(pattern: CustomMode, transition: 'fade'|'jump'|'strobe') {
				return new CustomMode().addColorList(pattern.colors.map(({ red, green, blue }) => {
					return [red, green, blue] as [number, number, number];
				})).setTransitionType(transition);
			}

			@errorHandle
			@requireParams('pattern')
			@auth
			public static async runPattern(res: ResponseLike, { pattern: patternName, speed, transition }: {
				pattern: CustomPattern;
				speed?: number;
				transition?: string;
				auth?: string;
			}) {
				if (!patterns.hasOwnProperty(patternName)) {
					attachMessage(res, `Pattern ${patternName} does not exist`);
					res.status(400).write('Unknown pattern');
					res.end();
					return false;
				}

				let { pattern, defaultSpeed } = patterns[patternName as CustomPattern];
				if (transition) {
					if (['fade', 'jump', 'strobe'].indexOf(transition) === -1) {
						attachMessage(res, `Invalid transition mode ${transition}`);
						res.status(400).write('Invalid transiton mode');
						res.end();
						return false;
					}

					pattern = this.overrideTransition(pattern, transition as TransitionTypes);
				}

				attachMessage(
					attachMessage(res, `Running pattern ${patternName}`),
					`Updated ${Clients.clients!.length} clients`);
				try {
					await Promise.all(Clients.clients!.map((c) => {
						return Promise.all([
							c.setCustomPattern(pattern, speed || defaultSpeed),
							c.turnOn()
						]);
					}));
					res.status(200).end();
					return true;
				} catch(e) {
					res.status(400).write('Failed to run pattern');
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
		type ExternalRequest = (({
			type: 'color';
		} & ({
			color: string;
		}|{
			r: string;
			g: string;
			b: string;
		}))|{
			type: 'power';
			state: 'on'|'off';
		}|{
			type: 'pattern';
			name: string;
			speed?: number;
			transition?: 'fade'|'jump'|'strobe';
		}) & {
			logObj: any;
			resolver: (value?: any) => void;
		}

		export class Handler {
			private static _requests: ExternalRequest[] = [];

			private static _ready: boolean = false;
			static async init() {
				this._ready = true;
				for (const req of this._requests) {
					await this._handleRequest(req);
				}
			}

			constructor(private _logObj: any) { }

			private static async _handleRequest(request: ExternalRequest) {
				const { logObj, resolver } = request;
				const resDummy = new ResDummy();
				let value = undefined;
				if (request.type === 'color') {
					if ('color' in request) {
						value = await API.Handler.setColor(resDummy, {
							color: request.color,
							auth: await Auth.Secret.getKey()
						});
					} else {
						const { r, g, b } = request;
						await API.Handler.setRGB(resDummy, {
							red: r,
							green: g,
							blue: b,
							auth: await Auth.Secret.getKey()
						});
					}
				} else if (request.type == 'power') {
					await API.Handler.setPower(resDummy, {
						power: request.state,
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

			async color(color: string) {
				return new Promise<boolean>((resolve) => {
					const req: ExternalRequest = {
						type: 'color',
						color: color,
						logObj: this._logObj,
						resolver: resolve
					};
					if (Handler._ready) {
						Handler._handleRequest(req);
					} else {
						Handler._requests.push(req)
					}
				});
			}

			async rgb(red: string, green: string, blue: string) {
				return new Promise((resolve) => {
					const req: ExternalRequest = {
						type: 'color',
						r: red,
						g: green,
						b: blue,
						logObj: this._logObj,
						resolver: resolve
					};
					if (Handler._ready) {
						Handler._handleRequest(req);
					} else {
						Handler._requests.push(req)
					}
				});
			}

			async power(state: 'on'|'off') {
				return new Promise((resolve) => {
					const req: ExternalRequest = {
						type: 'power',
						state: state,
						logObj: this._logObj,
						resolver: resolve
					};
					if (Handler._ready) {
						Handler._handleRequest(req);
					} else {
						Handler._requests.push(req)
					}
				});
			}

			async pattern(name: string, speed?: number, transition?: 'fade'|'jump'|'strobe') {
				return new Promise((resolve) => {
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
						Handler._requests.push(req)
					}
				});
			}
		}
	}

	export namespace Bot {
		export interface JSON {

		}

		export class State extends BotState.Base {
			static readonly matches = State.createMatchMaker(({
				matchMaker: mm
			}) => {
				mm(/turn (on|off) (rgb|led)/, async ({
					logObj, match
				}) => {
					const targetState = match[1];
					await new External.Handler(logObj).power(targetState as 'on'|'off');
					return `Turned it ${targetState}`;
				});
				mm(/set (rgb|led|it|them|color) to ([^ ]*)/, async ({
					logObj, match
				}) => {
					const color = match[2];
					if (await new External.Handler(logObj).color(color)) {
						return `Set color to ${color}`;
					} else {
						return 'Failed to set color (invalid color)';
					}
				});
				mm(/(start|launch) pattern ([^ ]*)(\s+with speed ([^ ]+))?(\s*and\s*)?(with transition ([^ ]+))?(\s*and\s*)?(\s*with speed ([^ ]+))?/, async ({
					logObj, match
				}) => {
					const [ , , pattern, , speed1, , , transition, , , speed2 ] = match;
					const speed = speed1 || speed2;
					if (await new External.Handler(logObj).pattern(pattern, parseInt(speed, 10) || undefined,
						(transition as any) || undefined)) {
							return `Started pattern ${pattern}`;
						} else {
							return 'Failed to start pattern';
						}
				});
				mm(/refresh (rgb|led)/, async ({
					logObj
				}) => {
					return `Found ${await Scan.scanRGBControllers(false, logObj)} RGB controllers`;
				});
			});

			constructor(_json?: JSON) {
				super();	
			}

			static async match(config: { 
				logObj: any; 
				text: string; 
				message: _Bot.TelegramMessage; 
				state: _Bot.Message.StateKeeping.ChatState; 
			}): Promise<_Bot.Message.MatchResponse | undefined> {
				return await this.matchLines({ ...config, matchConfig: State.matches });
			}

			toJSON(): JSON {
				return {};
			}
		}
	}

	export namespace WebPage {
		const patternPreviews = JSON.stringify(Object.keys(patterns).map((key) => {
			const { pattern: { colors, transitionType}, defaultSpeed } = patterns[key as CustomPattern];
			return {
				defaultSpeed,
				colors,
				transitionType,
				name: key
			}
		}));

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
			public static async index(res: ResponseLike, _req: express.Request, randomNum: number) {
				res.status(200);
				res.contentType('.html');
				res.write(await rgbHTML(randomNum));
				res.end();
			}
		}
	}

	export namespace Board {
		export const enum DIR {
			DIR_FORWARDS = 1,
			DIR_BACKWARDS = 0
		}

		export async function tryConnectRGBBoard() {
			const DEVICE_NAME = '/dev/ttyACM0';

			return new Promise<Board|null>((resolve) => {
				const port = new SerialPort(DEVICE_NAME, {
					baudRate: 115200
				});
				
				let err: boolean = false;
				port.on('error', (e) => {
					log(getTime(), chalk.red('Failed to connect to LED arduino', e));
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

					log(getTime(), chalk.gray(`[${DEVICE_NAME}]`),
						`Connected, ${LED_NUM} leds detected`);

					onData = (): any => {};
					resolve(new Board(port, (listener: (line: string) => any) => {
						onData = listener;
					}, LED_NUM))
				}

				parser.once('data', (line: string) => {
					onData(line);
				});
			});
		}

		export class Board {
			// @ts-ignore
			constructor(private _port: SerialPort, 
				private _setListener: (listener: (line: string) => any) => void, 
				public leds: number) {}

			public ping() {
				return new Promise<boolean>((resolve) => {
					this._setListener((_line: string) => {
						resolve(true);
					});
					this.getLeds();
					setTimeout(() => {
						resolve(false);
					}, 1000);
				});
			}

			public write(data: string) {
				this._port.write(data);
			}

			public sendCommand(command: string) {
				console.log('Sending command', command);
				this.write(`/ ${command} \\\n`);
			}

			public sendPrimed(command: string) {
				this.write(command + '\n');
			}

			public setModeOff() {
				this.sendCommand('off');
			}

			public getLeds() {
				return this.sendCommand('leds');
			}

			public setSolid({
				intensity = 0,
				r, g, b
			}: {
				intensity?: number;
				r: number;
				g: number;
				b: number;
			}) {
				this.sendCommand(`solid ${intensity} ${r} ${g} ${b}`);
			}

			public setDot({
				intensity = 0,
				backgroundRed, backgroundGreen,
				backgroundBlue, dots
			}: {
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
			}) {
				this.sendCommand(`dot ${intensity} ${backgroundRed} ${
					backgroundGreen} ${backgroundBlue} ${dots.map(({ 
						size, speed, dir, 
						dotPos, r, g, b 
					}) => {
						return `${size} ${speed} ${dir} ${dotPos} ${r} ${g} ${b}`;
					}).join(' ')}`)
			}

			public setSplit({
				intensity = 0,
				updateTime, dir, parts
			}: {
				intensity?: number;
				updateTime: number;
				dir: DIR;
				parts: {
					r: number;
					g: number;
					b: number;
				}[];
			}) {
				this.sendCommand(`split ${intensity} ${updateTime} ${dir} ${parts.map(({ 
						r, g, b 
					}) => {
						return `${r} ${g} ${b}`;
					}).join(' ')}`)
			}

			public setPattern({
				intensity = 0,
				blockSize = 0,
				updateTime, dir, parts
			}: {
				intensity?: number;
				updateTime: number;
				blockSize?: number;
				dir: DIR;
				parts: {
					r: number;
					g: number;
					b: number;
				}[];
			}) {
				this.sendCommand(`pattern ${intensity} ${updateTime} ${dir} ${blockSize} ${parts.map(({ 
						r, g, b 
					}) => {
						return `${r} ${g} ${b}`;
					}).join(' ')}`);
			}

			public setPrime() {
				this.sendCommand('prime');
			}

			public setFlash({
				intensity = 0,
				colors = [],
				updateTime, mode
			}: {
				intensity?: number;
				updateTime: number;
				mode: TransitionTypes;
				colors?: {
					r: number;
					g: number;
					b: number;
				}[];
			}) {
				this.sendCommand(`flash ${intensity} ${updateTime} ${mode} ${colors.map(({
						r, g, b 
					}) => {
						return `${r} ${g} ${b}`;
					}).join(' ')}`);
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
						const rgbIntensity = Math.round(relativeIntensity * 255);
						const redColor = rgbIntensity.toString(16);
						const redLonger = redColor.length === 1 ? ('0' + redColor) : redColor;
						return `${redLonger}0000`;
					}

					static parse(data: string) {
						const transformed = applyTransform(JSON.parse(data));
						console.log('Writing', this.colorFromIntensity(transformed));
						Clients.arduinoClients.forEach(c => c.board.sendPrimed(this.colorFromIntensity(transformed)));
					}
				}
			}
		}
	}

	export namespace Routing {
		export async function init({ app, randomNum, ws }: { 
			app: AppWrapper; 
			randomNum: number;
			ws: WSWrapper;
		}) {
			await Scan.scanRGBControllers(true);
			setInterval(Scan.scanRGBControllers, 1000 * 60 * 60);
			await External.Handler.init();

			app.post('/rgb/color/:color', async (req, res) => {
				await API.Handler.setColor(res, {...req.params, ...req.body});
			});
			app.post('/rgb/color/:red/:green/:blue', async (req, res) => {
				await API.Handler.setRGB(res, {...req.params, ...req.body});
			});
			app.post('/rgb/power/:power', async (req, res) => {
				await API.Handler.setPower(res, {...req.params, ...req.body});
			});
			app.post('/rgb/pattern/:pattern/:speed?/:transition?', async (req, res) => {
				await API.Handler.runPattern(res, {...req.params, ...req.body});
			});
			app.post('/rgb/refresh', async (_req, res) => {
				await API.Handler.refresh(res);
			});
			app.all('/rgb', async (req, res) => {
				await WebPage.Handler.index(res, req, randomNum);
			});

			ws.all('/music_visualize', async ({ addListener }) => {
				// Prime it
				if (Clients.arduinoClients.length === 0) {
					if (await Scan.scanArduinos() == 0) return;
				}
				Clients.arduinoClients.forEach(c => c.board.sendCommand('prime'));

				addListener((message: string) => {
					Visualizer.Music.Youtube.Handler.parse(message);
				});
			});
		}
	}
}

const colorList = {
	"aliceblue": "#f0f8ff",
	"antiquewhite": "#faebd7",
	"aqua": "#00ffff",
	"aquamarine": "#7fffd4",
	"azure": "#f0ffff",
	"beige": "#f5f5dc",
	"bisque": "#ffe4c4",
	"black": "#000000",
	"blanchedalmond": "#ffebcd",
	"blue": "#0000ff",
	"blueviolet": "#8a2be2",
	"brown": "#a52a2a",
	"burlywood": "#deb887",
	"cadetblue": "#5f9ea0",
	"chartreuse": "#7fff00",
	"chocolate": "#d2691e",
	"coral": "#ff7f50",
	"cornflowerblue": "#6495ed",
	"cornsilk": "#fff8dc",
	"crimson": "#dc143c",
	"cyan": "#00ffff",
	"darkblue": "#00008b",
	"darkcyan": "#008b8b",
	"darkgoldenrod": "#b8860b",
	"darkgray": "#a9a9a9",
	"darkgreen": "#006400",
	"darkgrey": "#a9a9a9",
	"darkkhaki": "#bdb76b",
	"darkmagenta": "#8b008b",
	"darkolivegreen": "#556b2f",
	"darkorange": "#ff8c00",
	"darkorchid": "#9932cc",
	"darkred": "#8b0000",
	"darksalmon": "#e9967a",
	"darkseagreen": "#8fbc8f",
	"darkslateblue": "#483d8b",
	"darkslategray": "#2f4f4f",
	"darkslategrey": "#2f4f4f",
	"darkturquoise": "#00ced1",
	"darkviolet": "#9400d3",
	"deeppink": "#ff1493",
	"deepskyblue": "#00bfff",
	"dimgray": "#696969",
	"dimgrey": "#696969",
	"dodgerblue": "#1e90ff",
	"firebrick": "#b22222",
	"floralwhite": "#fffaf0",
	"forestgreen": "#228b22",
	"fuchsia": "#ff00ff",
	"gainsboro": "#dcdcdc",
	"ghostwhite": "#f8f8ff",
	"gold": "#ffd700",
	"goldenrod": "#daa520",
	"gray": "#808080",
	"green": "#008000",
	"greenyellow": "#adff2f",
	"grey": "#808080",
	"honeydew": "#f0fff0",
	"hotpink": "#ff69b4",
	"indianred": "#cd5c5c",
	"indigo": "#4b0082",
	"ivory": "#fffff0",
	"khaki": "#f0e68c",
	"lavender": "#e6e6fa",
	"lavenderblush": "#fff0f5",
	"lawngreen": "#7cfc00",
	"lemonchiffon": "#fffacd",
	"lightblue": "#add8e6",
	"lightcoral": "#f08080",
	"lightcyan": "#e0ffff",
	"lightgoldenrodyellow": "#fafad2",
	"lightgray": "#d3d3d3",
	"lightgreen": "#90ee90",
	"lightgrey": "#d3d3d3",
	"lightpink": "#ffb6c1",
	"lightsalmon": "#ffa07a",
	"lightseagreen": "#20b2aa",
	"lightskyblue": "#87cefa",
	"lightslategray": "#778899",
	"lightslategrey": "#778899",
	"lightsteelblue": "#b0c4de",
	"lightyellow": "#ffffe0",
	"lime": "#00ff00",
	"limegreen": "#32cd32",
	"linen": "#faf0e6",
	"magenta": "#ff00ff",
	"maroon": "#800000",
	"mediumaquamarine": "#66cdaa",
	"mediumblue": "#0000cd",
	"mediumorchid": "#ba55d3",
	"mediumpurple": "#9370db",
	"mediumseagreen": "#3cb371",
	"mediumslateblue": "#7b68ee",
	"mediumspringgreen": "#00fa9a",
	"mediumturquoise": "#48d1cc",
	"mediumvioletred": "#c71585",
	"midnightblue": "#191970",
	"mintcream": "#f5fffa",
	"mistyrose": "#ffe4e1",
	"moccasin": "#ffe4b5",
	"navajowhite": "#ffdead",
	"navy": "#000080",
	"oldlace": "#fdf5e6",
	"olive": "#808000",
	"olivedrab": "#6b8e23",
	"orange": "#ffa500",
	"orangered": "#ff4500",
	"orchid": "#da70d6",
	"palegoldenrod": "#eee8aa",
	"palegreen": "#98fb98",
	"paleturquoise": "#afeeee",
	"palevioletred": "#db7093",
	"papayawhip": "#ffefd5",
	"peachpuff": "#ffdab9",
	"peru": "#cd853f",
	"pink": "#ffc0cb",
	"plum": "#dda0dd",
	"powderblue": "#b0e0e6",
	"purple": "#800080",
	"rebeccapurple": "#663399",
	"red": "#ff0000",
	"rosybrown": "#bc8f8f",
	"royalblue": "#4169e1",
	"saddlebrown": "#8b4513",
	"salmon": "#fa8072",
	"sandybrown": "#f4a460",
	"seagreen": "#2e8b57",
	"seashell": "#fff5ee",
	"sienna": "#a0522d",
	"silver": "#c0c0c0",
	"skyblue": "#87ceeb",
	"slateblue": "#6a5acd",
	"slategray": "#708090",
	"slategrey": "#708090",
	"snow": "#fffafa",
	"springgreen": "#00ff7f",
	"steelblue": "#4682b4",
	"tan": "#d2b48c",
	"teal": "#008080",
	"thistle": "#d8bfd8",
	"tomato": "#ff6347",
	"turquoise": "#40e0d0",
	"violet": "#ee82ee",
	"wheat": "#f5deb3",
	"white": "#ffffff",
	"whitesmoke": "#f5f5f5",
	"yellow": "#ffff00",
	"yellowgreen": "#9acd32"
};