import {
	LED_NAMES,
	NIGHTSTAND_COLOR,
	WAKELIGHT_TIME,
	MARKED_AUDIO_FOLDER,
	NUM_LEDS,
} from '../lib/constants';
import {
	errorHandle,
	requireParams,
	auth,
	authCookie,
	authAll,
	upgradeToHTTPS,
} from '../lib/decorators';
import { CustomMode, TransitionTypes } from 'magic-home';
import {
	attachMessage,
	attachSourcedMessage,
	LogObj,
	logTag,
	ResponseLike,
} from '../lib/logger';
import { ModuleConfig } from './modules';
import { Color, IColor } from '../lib/types';
import { wait, arrToObj } from '../lib/util';
import { BotState } from '../lib/bot-state';
import { colorList } from '../lib/data';
import { exec } from 'child_process';
import { ModuleMeta } from './meta';
import { Bot as _Bot } from './bot';
import * as express from 'express';
import { KeyVal } from './keyval';
import { Auth } from './auth';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { createExternalClass } from '../lib/external';
import { createRouter } from '../lib/api';
import { RGBEffectConfig } from './rgb/effect-config';
import { RGBClients, RGBScan } from './rgb/clients';

function getIntensityPercentage(percentage: number) {
	return Math.round((percentage / 100) * 255);
}

function restartSelf() {
	return new Promise<void>((resolve) => {
		// Restart this program
		exec(
			'sudo -u root su -c "zsh -c \\"source /root/.zshrc ; forever restart automation\\""',
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
			await (this.setup = new Promise((resolve) => {
				void (async () => {
					await Scan.scanRGBControllers(true);
					setInterval(() => {
						void Scan.scanRGBControllers();
					}, 1000 * 60 * 60);
					await External.Handler.init();
					initListeners();

					Routing.init(config);
				})().then(resolve);
			}));
		}

		get external() {
			return External;
		}

		get bot() {
			return Bot;
		}
	})();

	const EffectConfig = RGBEffectConfig;
	const Clients = RGBClients;
	const Scan = RGBScan;

	type CustomPattern =
		| 'rgb'
		| 'rainbow'
		| 'christmas'
		| 'strobe'
		| 'darkcolors'
		| 'shittyfire'
		| 'betterfire';

	const patterns: {
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
			defaultSpeed: 100,
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
			defaultSpeed: 100,
		},
		christmas: {
			pattern: new CustomMode()
				.addColor(255, 61, 42)
				.addColor(0, 239, 0)
				.setTransitionType('jump'),
			defaultSpeed: 70,
		},
		strobe: {
			pattern: new CustomMode()
				.addColor(255, 255, 255)
				.addColor(255, 255, 255)
				.addColor(255, 255, 255)
				.setTransitionType('strobe'),
			defaultSpeed: 100,
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
			defaultSpeed: 90,
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
			defaultSpeed: 90,
		},
		betterfire: {
			pattern: new CustomMode()
				.addColorList(
					new Array(15).fill('').map(() => {
						return [
							255 - Math.random() * 90,
							200 - Math.random() * 200,
							0,
						] as [number, number, number];
					})
				)
				.setTransitionType('fade'),
			defaultSpeed: 100,
		},
	};

	namespace ArduinoAPI {
		export const enum DIR {
			DIR_FORWARDS = 1,
			DIR_BACKWARDS = 0,
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
				end = true,
			}: {
				start?: boolean;
				end?: boolean;
			} = {}
		) {
			const stops: Color[] = [];
			if (start) {
				stops.push(c1);
			}

			const delta = 1 / steps;
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

			const i = Math.floor(h * 6);
			const f = h * 6 - i;
			const p = v * (1 - s);
			const q = v * (1 - f * s);
			const t = v * (1 - (1 - f) * s);
			switch (i % 6) {
				case 0:
					r = v;
					g = t;
					b = p;
					break;
				case 1:
					r = q;
					g = v;
					b = p;
					break;
				case 2:
					r = p;
					g = v;
					b = t;
					break;
				case 3:
					r = p;
					g = q;
					b = v;
					break;
				case 4:
					r = t;
					g = p;
					b = v;
					break;
				case 5:
					r = v;
					g = p;
					b = q;
					break;
			}
			return {
				r: Math.round(r! * 255),
				g: Math.round(g! * 255),
				b: Math.round(b! * 255),
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
								jumpDelay: 1,
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
								),
							])
							.toSequence(),
					}),
				]),
			},
			rainbow2: {
				description: 'Slightly bigger block size rainbow',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.FORWARDS,
							{
								jumpSize: 1,
								jumpDelay: 1,
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
								),
							])
							.toSequence(),
					}),
				]),
			},
			reddot: {
				description: 'Single red dot moving',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.FORWARDS,
							{
								jumpSize: 1,
								jumpDelay: 1,
							}
						),
						background: new Color(0, 0, 0),
						sequences: [
							new EffectConfig.ColorSequence(
								new Color(255, 0, 0),
								5
							),
						],
					}),
				]),
			},
			multidot: {
				description: 'A bunch of dots moving',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.FORWARDS,
							{
								jumpSize: 1,
								jumpDelay: 1,
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
							new EffectConfig.TransparentSequence(11),
						],
					}),
				]),
			},

			reddotbluebg: {
				description: 'A red dot moving on a blue background',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.FORWARDS,
							{
								jumpSize: 1,
								jumpDelay: 1,
							}
						),
						background: new Color(0, 0, 255),
						sequences: [
							new EffectConfig.ColorSequence(
								new Color(255, 0, 0),
								5
							),
						],
					}),
				]),
			},
			split: {
				description: 'A bunch of moving chunks of colors',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.FORWARDS,
							{
								jumpSize: 1,
								jumpDelay: 1,
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
							),
						],
					}),
				]),
			},
			rgb: {
				description: 'Red green and blue dots moving in a pattern',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.FORWARDS,
							{
								jumpSize: 1,
								jumpDelay: 1,
							}
						),
						background: new Color(0, 0, 0),
						sequences: new EffectConfig.Leds(NUM_LEDS)
							.fillWithColors([
								new Color(255, 0, 0),
								new Color(0, 255, 0),
								new Color(0, 0, 255),
							])
							.toSequence(),
					}),
				]),
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
							sequences: [],
						},
						1
					),
					new EffectConfig.LedSpecStep(
						{
							moveData: new EffectConfig.MoveData(
								EffectConfig.MOVING_STATUS.OFF
							),
							background: new Color(255, 255, 255),
							sequences: [],
						},
						1
					),
				]),
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
							sequences: [],
						},
						60
					),
					new EffectConfig.LedSpecStep(
						{
							moveData: new EffectConfig.MoveData(
								EffectConfig.MOVING_STATUS.OFF
							),
							background: new Color(255, 255, 255),
							sequences: [],
						},
						60
					),
				]),
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
							sequences: [],
						},
						500
					),
					new EffectConfig.LedSpecStep(
						{
							moveData: new EffectConfig.MoveData(
								EffectConfig.MOVING_STATUS.OFF
							),
							background: new Color(255, 255, 255),
							sequences: [],
						},
						500
					),
				]),
			},
			epileptisch: {
				description: 'A superfast flash',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.OFF
						),
						background: new Color(255, 0, 0),
						sequences: [],
					}),
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.OFF
						),
						background: new Color(0, 255, 0),
						sequences: [],
					}),
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.OFF
						),
						background: new Color(0, 0, 255),
						sequences: [],
					}),
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
						new Color(0, 255, 0),
					],
				},
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
						),
					].map(
						(color) =>
							new EffectConfig.LedSpecStep({
								moveData: new EffectConfig.MoveData(
									EffectConfig.MOVING_STATUS.OFF
								),
								background: color,
								sequences: [],
							})
					)
				),
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
							),
						],
					}),
				]),
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
							),
						],
					}),
				]),
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
							),
						],
					}),
				]),
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
							),
						],
					}),
				]),
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
							),
						],
					}),
				]),
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
							),
						],
					}),
				]),
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
							new EffectConfig.RandomColor(NUM_LEDS, 1000, true),
						],
					}),
				]),
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
							new EffectConfig.RandomColor(NUM_LEDS, 1, true),
						],
					}),
				]),
			},
			shrinkingreddots: {
				description: 'Shrinking red dots',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.FORWARDS,
							{
								jumpDelay: 1,
								jumpSize: 1,
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
										end: true,
									}
								)
							)
							.toSequence(),
					}),
				]),
			},
			shrinkingmulticolor: {
				description: 'Shrinking dots of multiple colors',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.FORWARDS,
							{
								jumpDelay: 1,
								jumpSize: 1,
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
										end: true,
									}
								).map(
									(color) =>
										new EffectConfig.SingleColor(color)
								)
							)
						),
					}),
				]),
			},
			shrinkingrainbows: {
				description: 'Shrinking rainbows',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.FORWARDS,
							{
								jumpDelay: 1,
								jumpSize: 1,
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
								new Color(255, 0, 0),
							])
							.toSequence(),
					}),
				]),
			},
			wiebel: {
				description: 'Wiebelend ding',
				effect: new EffectConfig.LedEffect([
					new EffectConfig.LedSpecStep({
						moveData: new EffectConfig.MoveData(
							EffectConfig.MOVING_STATUS.FORWARDS,
							{
								jumpDelay: 1,
								jumpSize: 1,
							}
						),
						background: new Color(0, 0, 0),
						sequences: new EffectConfig.Leds(NUM_LEDS)
							.fillWithColors([
								new Color(0, 255, 0),
								new Color(0, 0, 255),
							])
							.toSequence(),
					}),
				]),
			},
		};
		const typeCheck = arduinoEffects as {
			[key: string]: {
				effect: RGBEffectConfig.LedEffect;
				description: string;
			};
		};
		// @ts-ignore
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		typeCheck;
	}

	namespace HexAPI {
		export const hexEffects = {
			hexrainbowfast: {
				description: 'A quickly rotating rainbow',
				effect: {
					name: 'rainbow',
					params: {
						revolve_time: '500',
					},
				},
			},
			hexrainbowslow: {
				description: 'A slowly rotating rainbow',
				effect: {
					name: 'rainbow',
					params: {
						revolve_time: '25000',
					},
				},
			},
			hexrandomcolorsslow: {
				description: 'Random colors changing slowly (1s)',
				effect: {
					name: 'random_colors',
					params: {
						wait_time: '1000',
					},
				},
			},
			hexrandomcolorsfast: {
				description: 'Random colors changing quickly (250ms)',
				effect: {
					name: 'random_colors',
					params: {
						wait_time: '250',
					},
				},
			},
			hexrandomcolorsfastest: {
				description: 'Random colors changing very quickly (25ms)',
				effect: {
					name: 'random_colors',
					params: {
						wait_time: '25',
					},
				},
			},
			hexgradual: {
				description: 'Gradual color changes',
				effect: {
					name: 'random_colors_gradual',
					params: {
						wait_time_min: '500',
						wait_time_max: '3000',
						neighbour_influence: '128',
						use_pastel: 'false',
						use_split: 'false',
					},
				},
			},
			hexgradualslower: {
				description: 'Gradual color changes (a little slower)',
				effect: {
					name: 'random_colors_gradual',
					params: {
						wait_time_min: '100',
						wait_time_max: '5000',
						neighbour_influence: '128',
						use_pastel: 'false',
						use_split: 'false',
					},
				},
			},
			hexgradualpastel: {
				description: 'Gradual color changes (pastel)',
				effect: {
					name: 'random_colors_gradual',
					params: {
						wait_time_min: '500',
						wait_time_max: '3000',
						neighbour_influence: '128',
						use_pastel: 'true',
						use_split: 'false',
					},
				},
			},
			hexgradualbiginfluence: {
				description:
					'Gradual color changes with high neighbour influence',
				effect: {
					name: 'random_colors_gradual',
					params: {
						wait_time_min: '500',
						wait_time_max: '3000',
						neighbour_influence: '255',
						use_pastel: 'false',
						use_split: 'false',
					},
				},
			},
			hexgradualslow: {
				description: 'Gradual color changes slowly',
				effect: {
					name: 'random_colors_gradual',
					params: {
						wait_time_min: '500',
						wait_time_max: '5000',
						neighbour_influence: '128',
						use_pastel: 'false',
						use_split: 'false',
					},
				},
			},
			hexgradualnoinfluence: {
				description:
					'Gradual color changes without neighbour influence',
				effect: {
					name: 'random_colors_gradual',
					params: {
						wait_time_min: '500',
						wait_time_max: '5000',
						neighbour_influence: '0',
						use_pastel: 'true',
						use_split: 'false',
					},
				},
			},
			hexgradualsplit: {
				description: 'Gradual color changes that are split',
				effect: {
					name: 'random_colors_gradual',
					params: {
						wait_time_min: '500',
						wait_time_max: '5000',
						neighbour_influence: '0',
						use_pastel: 'true',
						use_split: 'true',
					},
				},
			},
		};
	}

	export namespace API {
		export const HEX_REGEX =
			/#([a-fA-F\d]{2})([a-fA-F\d]{2})([a-fA-F\d]{2})/;
		export function hexToRGB(hex: string): Color {
			const match = HEX_REGEX.exec(hex)!;

			const [, r, g, b] = match;
			return new Color(parseInt(r, 16), parseInt(g, 16), parseInt(b, 16));
		}

		function singleNumToHex(num: number) {
			if (num < 10) {
				return String(num);
			}
			return String.fromCharCode(97 + (num - 10));
		}

		export function toHex(num: number): string {
			return (
				singleNumToHex(Math.floor(num / 16)) + singleNumToHex(num % 16)
			);
		}

		// TODO: replace with new color functions
		export function rgbToHex(
			red: number,
			green: number,
			blue: number
		): string {
			return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
		}

		export function colorToHex(color: Color): string {
			return rgbToHex(color.r, color.g, color.b);
		}

		export class Handler {
			private static _getClientSetFromTarget(target: string) {
				switch (target) {
					case 'hex':
					case 'hexes':
						return Clients.hexClients;
					case 'magic':
					case 'magichome':
					case 'magic-home':
						return Clients.magicHomeClients;
					case 'ceiling':
					case 'ceilingled':
					case 'ceiling-led':
					case 'arduino':
						return Clients.arduinoClients;
					case 'all':
					case 'rgb':
					case 'led':
					case 'leds':
					case 'it':
					case 'them':
					case 'color':
					default:
						return Clients.clients;
				}
			}

			@errorHandle
			@requireParams('color')
			@auth
			public static async setColor(
				res: ResponseLike,
				{
					color,
					intensity,
					target = 'all',
				}: {
					color: string;
					intensity?: number;
					auth?: string;
					target?: string;
				},
				source: string
			): Promise<boolean> {
				color = color.toLowerCase().trim();
				if (!(color in colorList)) {
					attachMessage(res, `Unknown color "${color}"`);
					res.status(400).end();
					return false;
				}
				const hexColor = colorList[color as keyof typeof colorList];
				const { r, g, b } = hexToRGB(hexColor);

				const clientSet = this._getClientSetFromTarget(target);
				attachMessage(
					attachMessage(
						attachSourcedMessage(
							res,
							source,
							await meta.explainHook,
							`rgb(${r}, ${g}, ${b})`
						),
						chalk.bgHex(hexColor)('   ')
					),
					`Updated ${clientSet.length} clients`
				);

				if (
					(
						await Promise.all(
							clientSet.map(async (client) => {
								return client.setColorWithBrightness(
									r,
									g,
									b,
									100,
									intensity
								);
							})
						)
					).every((v) => v)
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
					intensity,
					target = 'all',
				}: {
					red: string;
					green: string;
					blue: string;
					auth?: string;
					intensity?: number;
					target?: string;
				},
				source: string
			): Promise<boolean> {
				const redNum = Math.min(255, Math.max(0, parseInt(red, 10)));
				const greenNum = Math.min(
					255,
					Math.max(0, parseInt(green, 10))
				);
				const blueNum = Math.min(255, Math.max(0, parseInt(blue, 10)));
				const clientSet = this._getClientSetFromTarget(target);
				attachMessage(
					attachMessage(
						attachSourcedMessage(
							res,
							source,
							await meta.explainHook,
							`rgb(${red}, ${green}, ${blue})`
						),
						chalk.bgHex(rgbToHex(redNum, greenNum, blueNum))('   ')
					),
					`Updated ${clientSet.length} clients`
				);

				if (
					(
						await Promise.all(
							clientSet.map(async (client) => {
								return client.setColorWithBrightness(
									redNum,
									greenNum,
									blueNum,
									100,
									intensity
								);
							})
						)
					).every((v) => v)
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
					power,
				}: {
					power: string;
					auth?: string;
				},
				source: string
			): Promise<boolean> {
				attachMessage(
					attachSourcedMessage(
						res,
						source,
						await meta.explainHook,
						`Turned ${power}`
					),
					`Updated ${Clients.clients.length} clients`
				);
				if (
					(
						await Promise.all(
							Clients.clients.map((c) =>
								power === 'on' ? c.turnOn() : c.turnOff()
							)
						)
					).every((v) => v)
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
			): CustomMode {
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
				} & Record<string, unknown>,
				source: string
			): Promise<boolean> {
				const { effect: effectName } = body;
				if (
					!Object.prototype.hasOwnProperty.call(
						ArduinoAPI.arduinoEffects,
						effectName
					) &&
					!Object.prototype.hasOwnProperty.call(
						HexAPI.hexEffects,
						effectName
					)
				) {
					attachMessage(res, `Effect ${effectName} does not exist`);
					res.status(400).write('Unknown effect');
					res.end();
					return false;
				}

				const isArduinoEffect = !!ArduinoAPI.arduinoEffects[effectName];
				const effects = {
					...ArduinoAPI.arduinoEffects,
					...HexAPI.hexEffects,
				};
				const effect = effects[effectName];

				try {
					const strings = isArduinoEffect
						? await Promise.all(
								Clients.arduinoClients.map(async (c) => {
									return c.board.runEffect(effect.effect);
								})
						  )
						: await Promise.all(
								Clients.hexClients.map(async (c) =>
									c.runEffect(
										(
											effect.effect as unknown as {
												name: string;
												params: Record<string, string>;
											}
										).name,
										(
											effect.effect as unknown as {
												name: string;
												params: Record<string, string>;
											}
										).params
									)
								)
						  );
					attachMessage(
						attachMessage(
							attachSourcedMessage(
								res,
								source,
								await meta.explainHook,
								`Running effect ${effectName}`
							),
							`Updated ${Clients.arduinoClients.length} clients`
						),
						`Sent string "${String(strings[0])}"`
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
			public static async refresh(res: ResponseLike): Promise<void> {
				await Scan.scanRGBControllers();
				res.status(200);
				res.end();
			}
		}
	}

	export namespace External {
		export class Handler extends createExternalClass(true) {
			async color(
				color: string,
				target = 'all',
				intensity = 0
			): Promise<boolean> {
				return this.runRequest((res, source) => {
					return API.Handler.setColor(
						res,
						{
							color,
							intensity: intensity,
							auth: Auth.Secret.getKey(),
							target: target,
						},
						source
					);
				});
			}

			async rgb(
				red: string,
				green: string,
				blue: string,
				intensity = 0,
				target = 'all'
			): Promise<boolean> {
				return this.runRequest((res, source) => {
					return API.Handler.setRGB(
						res,
						{
							red,
							green,
							blue,
							intensity: intensity,
							auth: Auth.Secret.getKey(),
							target: target,
						},
						source
					);
				});
			}

			async power(state: 'on' | 'off'): Promise<boolean> {
				return this.runRequest((res, source) => {
					return API.Handler.setPower(
						res,
						{
							power: state,
							auth: Auth.Secret.getKey(),
						},
						source
					);
				});
			}

			async effect(
				name: ArduinoAPI.Effects,
				extra: ArduinoAPI.JoinedConfigs = {}
			): Promise<boolean> {
				return this.runRequest((res, source) => {
					return API.Handler.runEffect(
						res,
						{
							effect: name,
							auth: Auth.Secret.getKey(),
							...extra,
						},
						source
					);
				});
			}

			async markedAudio(
				file: string,
				helpers: Pick<
					BotState.MatchHandlerParams,
					'ask' | 'sendText' | 'askCancelable'
				>
			): ReturnType<typeof MarkedAudio.play> {
				return this.runRequest((_res, _source, logObj) => {
					return MarkedAudio.play(file, logObj, helpers);
				});
			}
		}
	}

	export namespace Bot {
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
					[
						...Object.keys(ArduinoAPI.arduinoEffects),
						...Object.keys(HexAPI.hexEffects),
					].map((key) => {
						const value =
							ArduinoAPI.arduinoEffects[
								key as ArduinoAPI.Effects
							] ||
							HexAPI.hexEffects[
								key as keyof typeof HexAPI.hexEffects
							];
						return [
							`/effect${key}`,
							`Effect. ${value.description}`,
						];
					})
				),
			};

			static readonly botName = 'RGB';

			static colorTextToColor(text: string): Color | null {
				if (API.HEX_REGEX.test(text)) {
					return API.hexToRGB(text);
				}
				if (text in colorList) {
					return API.hexToRGB(
						colorList[text as keyof typeof colorList]
					);
				}
				return null;
			}

			static parseDir(dir: string): ArduinoAPI.DIR {
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
							return 'Turned it on';
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
							return 'Turned it off';
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
								await client.turnOn();
								return 'Turned it on';
							} else {
								attachMessage(logObj, 'Turned it off');
								await client.turnOff();
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
										Clients.arduinoClients.map((c) =>
											targetState === 'on'
												? c.turnOn()
												: c.turnOff()
										)
									)
								).every((v) => v)
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
										Clients.magicHomeClients.map((c) =>
											targetState === 'on'
												? c.turnOff()
												: c.turnOff()
										)
									)
								).every((v) => v)
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
						/set (rgb|led(?:s)?|it|them|color|hexes|hex|ceiling|ceilingled|arduino|magic|magichome) to (?:(?:(\d+) (\d+) (\d+))|([^ ]+))(\s+with intensity (\d+))?/,
						async ({ logObj, match, matchText }) => {
							const target = match[1];
							const colorR = match[2];
							const colorG = match[3];
							const colorB = match[4];
							const colorStr = match[5];
							const intensity = match[7];
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
									String(resolvedColor.r),
									String(resolvedColor.g),
									String(resolvedColor.b),
									intensity?.length
										? parseInt(intensity, 10)
										: 0,
									target
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
						/\/color (?:(?:(\d+) (\d+) (\d+))|([^ ]+))/,
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
									String(resolvedColor.r),
									String(resolvedColor.g),
									String(resolvedColor.b),
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
							if (
								!(effectName in ArduinoAPI.arduinoEffects) &&
								!(effectName in HexAPI.hexEffects)
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
									ArduinoAPI.arduinoEffects[effectName] ||
										HexAPI.hexEffects[
											effectName as keyof typeof HexAPI.hexEffects
										]
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
							if (match?.[1]) {
								const effectName =
									`s${match[1]}` as ArduinoAPI.Effects;
								if (
									!(
										effectName in ArduinoAPI.arduinoEffects
									) &&
									!(effectName in HexAPI.hexEffects)
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
										ArduinoAPI.arduinoEffects[effectName] ||
											HexAPI.hexEffects[
												effectName as keyof typeof HexAPI.hexEffects
											]
									)}`;
								} else {
									return 'Failed to start effect';
								}
							}

							return `Effects are:\n${[
								...Object.keys(ArduinoAPI.arduinoEffects),
								...Object.keys(HexAPI.hexEffects),
							]
								.map((key) => {
									const value =
										ArduinoAPI.arduinoEffects[
											key as ArduinoAPI.Effects
										] ||
										HexAPI.hexEffects[
											key as keyof typeof HexAPI.hexEffects
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
					mm('/help_rgb', /what commands are there for rgb/, () => {
						return `Commands are:\n${Bot.matches.matches
							.map((match) => {
								return `RegExps: ${match.regexps
									.map((r) => r.source)
									.join(', ')}. Texts: ${match.texts.join(
									', '
								)}}`;
							})
							.join('\n')}`;
					});
					mm('/reconnect', /reconnect( to arduino)?/, async () => {
						logTag('self', 'red', 'Reconnecting to arduino');
						const amount = await Scan.scanArduinos();
						return `Found ${amount} arduino clients`;
					});
					mm(
						'/restart',
						/restart( yourself)?/,
						/reboot( yourself)?/,
						() => {
							logTag('self', 'red', 'Restarting self');
							setTimeout(async () => {
								await restartSelf();
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
							askCancelable,
						}) => {
							const file = match[1];
							const { message, success } =
								await new External.Handler(
									logObj,
									'BOT.marked'
								).markedAudio(file, {
									ask,
									sendText,
									askCancelable,
								});

							if (success) {
								return message || 'Playing!';
							}
							return message!;
						}
					);
				}
			);

			constructor(_json?: Record<string, never>) {
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
					matchConfig: Bot.matches,
				});
			}

			toJSON(): Record<string, never> {
				return {};
			}
		}
	}

	export namespace WebPage {
		const patternPreviews = JSON.stringify(
			Object.keys(patterns).map((key) => {
				const {
					pattern: { colors, transitionType },
					defaultSpeed,
				} = patterns[key as CustomPattern];
				return {
					defaultSpeed,
					colors,
					transitionType,
					name: key,
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
			): void {
				res.status(200);
				res.contentType('.html');
				res.write(rgbHTML(randomNum));
				res.end();
			}
		}
	}

	export namespace MarkedAudio {
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
			logObj: LogObj
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
					message: 'File does not exist',
				};
			}

			// Read it
			const file = await fs.readFile(filePath, {
				encoding: 'utf8',
			});

			// Parse it
			let parsed: ParsedMarked | null = null;
			try {
				parsed = JSON.parse(file);
			} catch (e) {
				return {
					success: false,
					message: 'Failed to parse file',
				};
			}

			// Try and authenticate
			const modules = await meta.modules;
			const authenticated =
				await new modules.spotifyBeats.External.Handler(
					logObj,
					'RGB.MARKED'
				).test();
			if (!authenticated) {
				return {
					success: false,
					message: 'Unauthenticated',
				};
			}

			return parsed!;
		}

		async function startPlay(
			logObj: LogObj,
			helpers: Pick<BotState.MatchHandlerParams, 'ask' | 'sendText'>,
			parsed: ParsedMarked
		): Promise<
			| { success: true; message: string | null }
			| { success: false; message: string }
			| null
		> {
			// Get devices
			const modules = await meta.modules;
			const devices = await new modules.spotifyBeats.External.Handler(
				logObj,
				'RGB.MARKED'
			).getDevices();

			const devicesParsed = devices && (await devices.json());

			if (
				!devices ||
				!devicesParsed ||
				devicesParsed.devices.length === 0
			) {
				return {
					success: false,
					message: 'Failed to find devices',
				};
			}

			// Ask user what device to use
			const response = await helpers.ask(
				`On what device do you want to play? Type the name to choose and type "cancel" to cancel.\n${devicesParsed.devices
					.map((device) => {
						return device.name;
					})
					.join(', ')}`
			);
			if (!response || response.toLowerCase() === 'cancel') {
				return {
					success: true,
					message: 'Canceled by user',
				};
			}

			// Get chosen device
			const chosen = devicesParsed.devices.find(
				(d) => d.name.toLowerCase() === response.toLowerCase()
			);

			if (!chosen) {
				return {
					success: false,
					message: 'Unknown device',
				};
			}

			// Play
			const playResponse =
				await new modules.spotifyBeats.External.Handler(
					logObj,
					'RGB.MARKED'
				).play(parsed['spotify-uri'], chosen.id);

			if (
				!playResponse ||
				playResponse.status >= 300 ||
				playResponse.status < 200
			) {
				return {
					success: false,
					message: 'Failed to play',
				};
			}

			return null;
		}

		export async function play(
			name: string,
			logObj: LogObj,
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
			const modules = await meta.modules;
			const playState =
				await modules.spotifyBeats.Spotify.API.getPlayState();
			if (!playState) {
				return {
					success: false,
					message: 'Failed to play',
				};
			}

			const playingTime =
				Date.now() - playState.playStart! + (parsed.offset ?? 0);

			const timeouts: NodeJS.Timeout[] = [];
			parsed.items.forEach((item) => {
				timeouts.push(
					setTimeout(() => {
						Clients.arduinoClients.forEach((c) =>
							c.setColor(
								parsed.color.r,
								parsed.color.g,
								parsed.color.b
							)
						);
						timeouts.push(
							setTimeout(() => {
								Clients.arduinoClients.forEach((c) =>
									c.setColor(0, 0, 0)
								);
							}, Math.min(item.duration, 1) * 1000)
						);
					}, item.time * 1000 - playingTime)
				);
			});

			// eslint-disable-next-line @typescript-eslint/unbound-method
			const { cancel, prom } = helpers.askCancelable(
				'Tell me when I need to stop by saying anything'
			);

			void prom.then(async () => {
				timeouts.forEach((t) => clearTimeout(t));
				await wait(1000);
				Clients.arduinoClients.forEach((c) => c.setColor(0, 0, 0));

				await helpers.sendText('stopped');
			});

			const lastItem = parsed.items[parsed.items.length - 1];
			await wait(
				lastItem.time * 1000 - playingTime + lastItem.duration * 1000
			);

			cancel();

			return {
				success: true,
				message: 'Done playing',
			};
		}
	}

	export namespace Routing {
		export function init({ app, randomNum }: ModuleConfig): void {
			const router = createRouter(RGB, API.Handler);
			router.post('/color', 'setColor');
			router.post('/color/:color/:instensity?', 'setColor');
			router.post('/color/:red/:green/:blue/:intensity?', 'setRGB');
			router.post('/power/:power', 'setPower');
			router.post('/effect/:effect', 'runEffect');
			router.all('/refresh', 'refresh');
			router.all('', (req, res) => {
				WebPage.Handler.index(res, req, randomNum);
			});
			router.use(app);
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

	async function switchLed(name: LED_NAMES, value: string, logObj: LogObj) {
		const client = Clients.getLed(name);
		if (!client) {
			return;
		}
		if (value === '1') {
			attachSourcedMessage(
				logObj,
				'keyval listener',
				await meta.explainHook,
				'Setting',
				chalk.bold(client.address),
				'to on'
			);
			(await meta.explainHook)(
				`Set rgb ${name} to white`,
				'keyval listener',
				logObj
			);
			if ([LED_NAMES.HEX_LEDS].includes(name)) {
				return client.turnOn();
			}
			return client.setColor(255, 255, 255);
		} else if (value === '0') {
			attachSourcedMessage(
				logObj,
				'keyval listener',
				await meta.explainHook,
				'Turned off',
				chalk.bold(client.address)
			);
			return client.turnOff();
		}
		return Promise.resolve();
	}

	let wakelights: NodeJS.Timeout[] = [];
	function cancelActiveWakelights() {
		wakelights.forEach((timer) => clearInterval(timer));
		wakelights = [];
	}

	function initListeners() {
		KeyVal.GetSetListener.addListener(
			'room.lights.nightstand',
			async (value, logObj) => {
				cancelActiveWakelights();

				const client = Clients.getLed(LED_NAMES.BED_LEDS);
				if (!client) {
					return;
				}
				if (value === '1') {
					attachMessage(
						attachSourcedMessage(
							logObj,
							'keyval listener',
							await meta.explainHook,
							'Setting',
							chalk.bold(client.address),
							`to color rgb(${NIGHTSTAND_COLOR.r}, ${NIGHTSTAND_COLOR.g}, ${NIGHTSTAND_COLOR.b})`
						),
						chalk.bgHex(API.colorToHex(NIGHTSTAND_COLOR))('   ')
					);
					await client.setColor(
						NIGHTSTAND_COLOR.r,
						NIGHTSTAND_COLOR.g,
						NIGHTSTAND_COLOR.b
					);
				} else if (value === '0') {
					attachSourcedMessage(
						logObj,
						'keyval listener',
						await meta.explainHook,
						'Turned off',
						chalk.bold(client.address)
					);
					await client.turnOff();
				}
				return Promise.resolve();
			}
		);

		KeyVal.GetSetListener.addListener(
			'room.leds.wakelight',
			async (value, logObj) => {
				cancelActiveWakelights();

				const client = Clients.getLed(LED_NAMES.BED_LEDS);
				if (!client) {
					return;
				}
				if (value === '1') {
					attachMessage(
						attachSourcedMessage(
							logObj,
							'keyval listener',
							await meta.explainHook,
							'Fading in',
							chalk.bold(client.address),
							`to color rgb(${NIGHTSTAND_COLOR.r}, ${NIGHTSTAND_COLOR.g}, ${NIGHTSTAND_COLOR.b})`
						),
						chalk.bgHex(API.colorToHex(NIGHTSTAND_COLOR))('   ')
					);

					let count = 2;
					const interval = setInterval(async () => {
						await client.setColor(
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
					await client.setColor(
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
						await meta.explainHook,
						'Turned off',
						chalk.bold(client.address)
					);
					await client.turnOff();
				}
				return Promise.resolve();
			}
		);
		Object.entries({
			'room.leds.ceiling': LED_NAMES.CEILING_LEDS,
			'room.leds.bed': LED_NAMES.BED_LEDS,
			'room.leds.desk': LED_NAMES.DESK_LEDS,
			'room.leds.wall': LED_NAMES.WALL_LEDS,
			'room.leds.couch': LED_NAMES.COUCH_LEDS,
			'room.leds.hexes': LED_NAMES.HEX_LEDS,
		}).forEach(([key, ledName]) => {
			KeyVal.GetSetListener.addListener(key, async (value, logObj) => {
				await switchLed(ledName, value, logObj);
			});
		});
	}
}
