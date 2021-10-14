import { Color } from '../../lib/color';
import { NUM_LEDS } from '../../lib/constants';
import {
	ColorSequence,
	LedEffect,
	Leds,
	LedSpecStep,
	MoveData,
	MOVING_STATUS,
	RandomColor,
	Repeat,
	SingleColor,
	TransparentSequence,
} from './effect-config';

export type Effects = keyof typeof arduinoEffects;

function getIntensityPercentage(percentage: number) {
	return Math.round((percentage / 100) * 255);
}

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

function flatten<V>(arr: V[][]): V[] {
	const flattened: V[] = [];
	for (const value of arr) {
		flattened.push(...value);
	}
	return flattened;
}

function getRandomColor() {
	const h = Math.round(Math.random() * 255);
	return Color.fromHSV(h, 255, 255);
}

export const arduinoEffects = {
	rainbow: {
		description: 'Forwards moving rainbow pattern',
		effect: new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.FORWARDS, {
					jumpSize: 1,
					jumpDelay: 1,
				}),
				background: new Color(0, 0, 0),
				sequences: new Leds(NUM_LEDS)
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
		effect: new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.FORWARDS, {
					jumpSize: 1,
					jumpDelay: 1,
				}),
				background: new Color(0, 0, 0),
				sequences: new Leds(NUM_LEDS)
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
		effect: new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.FORWARDS, {
					jumpSize: 1,
					jumpDelay: 1,
				}),
				background: new Color(0, 0, 0),
				sequences: [new ColorSequence(new Color(255, 0, 0), 5)],
			}),
		]),
	},
	awakenings: {
		description: 'Awakenings',
		effect: new LedEffect(
			[
				{
					jumpSize: 1,
					jumpDelay: 5,
				},
				{
					jumpSize: 1,
					jumpDelay: 1,
				},
				{
					jumpSize: 2,
					jumpDelay: 1,
				},
			].map(
				({ jumpSize, jumpDelay }) =>
					new LedSpecStep({
						moveData: new MoveData(MOVING_STATUS.FORWARDS, {
							jumpSize,
							jumpDelay,
						}),
						background: new Color(0, 0, 0),
						sequences: new Leds(NUM_LEDS)
							.fillWithColors(
								interpolate(
									new Color(255, 255, 255),
									new Color(0, 0, 0),
									5,
									{
										start: true,
										end: true,
									}
								)
							)
							.toSequence(),
					})
			)
		),
	},
	multidot: {
		description: 'A bunch of dots moving',
		effect: new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.FORWARDS, {
					jumpSize: 1,
					jumpDelay: 1,
				}),
				background: new Color(0, 0, 0),
				sequences: [
					new ColorSequence(new Color(255, 0, 0), 1),
					new TransparentSequence(11),
					new ColorSequence(new Color(255, 0, 0), 1),
					new TransparentSequence(11),
					new ColorSequence(new Color(255, 0, 0), 1),
					new TransparentSequence(11),
					new ColorSequence(new Color(255, 0, 0), 1),
					new TransparentSequence(11),
					new ColorSequence(new Color(255, 0, 0), 1),
					new TransparentSequence(11),
				],
			}),
		]),
	},

	reddotbluebg: {
		description: 'A red dot moving on a blue background',
		effect: new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.FORWARDS, {
					jumpSize: 1,
					jumpDelay: 1,
				}),
				background: new Color(0, 0, 255),
				sequences: [new ColorSequence(new Color(255, 0, 0), 5)],
			}),
		]),
	},
	split: {
		description: 'A bunch of moving chunks of colors',
		effect: new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.FORWARDS, {
					jumpSize: 1,
					jumpDelay: 1,
				}),
				background: new Color(0, 0, 0),
				sequences: [
					new ColorSequence(new Color(0, 0, 255), NUM_LEDS / 4),
					new ColorSequence(new Color(255, 0, 0), NUM_LEDS / 4),
					new ColorSequence(new Color(255, 0, 255), NUM_LEDS / 4),
					new ColorSequence(new Color(0, 255, 0), NUM_LEDS / 4),
				],
			}),
		]),
	},
	rgb: {
		description: 'Red green and blue dots moving in a pattern',
		effect: new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.FORWARDS, {
					jumpSize: 1,
					jumpDelay: 1,
				}),
				background: new Color(0, 0, 0),
				sequences: new Leds(NUM_LEDS)
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
		effect: new LedEffect([
			new LedSpecStep(
				{
					moveData: new MoveData(MOVING_STATUS.OFF),
					background: new Color(0, 0, 0),
					sequences: [],
				},
				1
			),
			new LedSpecStep(
				{
					moveData: new MoveData(MOVING_STATUS.OFF),
					background: new Color(255, 255, 255),
					sequences: [],
				},
				1
			),
		]),
	},
	strobe: {
		description: 'A bunch of moving chunks of colors',
		effect: new LedEffect([
			new LedSpecStep(
				{
					moveData: new MoveData(MOVING_STATUS.OFF),
					background: new Color(0, 0, 0),
					sequences: [],
				},
				60
			),
			new LedSpecStep(
				{
					moveData: new MoveData(MOVING_STATUS.OFF),
					background: new Color(255, 255, 255),
					sequences: [],
				},
				60
			),
		]),
	},
	slowstrobe: {
		description: 'A slow strobe',
		effect: new LedEffect([
			new LedSpecStep(
				{
					moveData: new MoveData(MOVING_STATUS.OFF),
					background: new Color(0, 0, 0),
					sequences: [],
				},
				500
			),
			new LedSpecStep(
				{
					moveData: new MoveData(MOVING_STATUS.OFF),
					background: new Color(255, 255, 255),
					sequences: [],
				},
				500
			),
		]),
	},
	epileptisch: {
		description: 'A superfast flash',
		effect: new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.OFF),
				background: new Color(255, 0, 0),
				sequences: [],
			}),
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.OFF),
				background: new Color(0, 255, 0),
				sequences: [],
			}),
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.OFF),
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
		effect: new LedEffect(
			[
				...interpolate(new Color(255, 0, 0), new Color(0, 255, 0), 5, {
					end: false,
				}),
				...interpolate(new Color(0, 255, 0), new Color(0, 0, 255), 5, {
					end: false,
				}),
				...interpolate(new Color(0, 0, 255), new Color(255, 0, 0), 5, {
					end: false,
				}),
			].map(
				(color) =>
					new LedSpecStep({
						moveData: new MoveData(MOVING_STATUS.OFF),
						background: color,
						sequences: [],
					})
			)
		),
	},
	desk: {
		description: 'An illumination of just my desk',
		effect: new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.OFF),
				background: new Color(0, 0, 0),
				sequences: [
					new ColorSequence(new Color(255, 255, 255), 75),
					new TransparentSequence(550),
					new ColorSequence(new Color(255, 255, 255), 275),
				],
			}),
		]),
	},
	randomslow: {
		description: 'A slow flash of random colors of block size 1',
		effect: new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.OFF),
				background: new Color(0, 0, 0),
				sequences: [
					new Repeat(NUM_LEDS, new RandomColor(1, 1000, true)),
				],
			}),
		]),
	},
	randomslowbig: {
		description: 'A slow flash of random colors of block size 10',
		effect: new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.OFF),
				background: new Color(0, 0, 0),
				sequences: [
					new Repeat(NUM_LEDS / 10, new RandomColor(10, 1000, true)),
				],
			}),
		]),
	},
	randomblocks: {
		description: 'A fast flash of big chunks of random colors',
		effect: new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.OFF),
				background: new Color(0, 0, 0),
				sequences: [
					new Repeat(NUM_LEDS / 20, new RandomColor(20, 1, true)),
				],
			}),
		]),
	},
	randomfast: {
		description: 'A fast flash of random colors of block size 1',
		effect: new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.OFF),
				background: new Color(0, 0, 0),
				sequences: [new Repeat(NUM_LEDS, new RandomColor(1, 1, true))],
			}),
		]),
	},
	randomparty: {
		description: 'Big slow chunks',
		effect: new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.OFF),
				background: new Color(0, 0, 0),
				sequences: [
					new Repeat(NUM_LEDS / 75, new RandomColor(75, 150, true)),
				],
			}),
		]),
	},
	randomfull: {
		description: 'A single random color updating slowly',
		effect: new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.OFF),
				background: new Color(0, 0, 0),
				sequences: [new RandomColor(NUM_LEDS, 1000, true)],
			}),
		]),
	},
	randomfullfast: {
		description: 'A single random color updating quickly',
		effect: new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.OFF),
				background: new Color(0, 0, 0),
				sequences: [new RandomColor(NUM_LEDS, 1, true)],
			}),
		]),
	},
	shrinkingreddots: {
		description: 'Shrinking red dots',
		effect: new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.FORWARDS, {
					jumpDelay: 1,
					jumpSize: 1,
				}),
				background: new Color(0, 0, 0),
				sequences: new Leds(NUM_LEDS)
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
		effect: new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.FORWARDS, {
					jumpDelay: 1,
					jumpSize: 1,
				}),
				background: new Color(0, 0, 0),
				sequences: flatten(
					new Array(90).fill('').map(() =>
						interpolate(new Color(0, 0, 0), getRandomColor(), 10, {
							start: true,
							end: true,
						}).map((color) => new SingleColor(color))
					)
				),
			}),
		]),
	},
	shrinkingrainbows: {
		description: 'Shrinking rainbows',
		effect: new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.FORWARDS, {
					jumpDelay: 1,
					jumpSize: 1,
				}),
				background: new Color(0, 0, 0),
				sequences: new Leds(NUM_LEDS)
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
		effect: new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.FORWARDS, {
					jumpDelay: 1,
					jumpSize: 1,
				}),
				background: new Color(0, 0, 0),
				sequences: new Leds(NUM_LEDS)
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
		effect: LedEffect;
		description: string;
	};
};
// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
typeCheck;
