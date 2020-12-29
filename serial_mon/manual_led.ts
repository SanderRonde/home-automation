#!/usr/bin/env node

import * as SerialPort from 'serialport';

const NUM_LEDS = 900;

interface IO {
	baud: number;
	file: string;
}

function getIO(): IO {
	let baud = 115200;
	let file = '/dev/ttyACM0';

	return { baud, file };
}

async function connect({ baud, file }: IO, effect: LedEffect) {
	const port = new SerialPort(file, {
		baudRate: baud
	});
	port.on('error', e => {
		console.error('error', e);
		process.exit(1);
	});

	let responded: boolean = false;
	port.on('data', chunk => {
		console.log('#', chunk.toString());
		if (!responded && chunk.toString().includes('ready')) {
			responded = true;
			port.write(new LedSpec(effect).toBytes());
		}
	});

	const interval = setInterval(() => {
		if (responded) {
			clearInterval(interval);
			return;
		}
		port.write('manual\n');
	}, 500);
}



const EFFECTS = {
	MOVING_DOT: ({
		jumpDelay,
		foreground,
		background
	}: {
		jumpDelay: number;
		foreground: Color;
		background: Color;
	}) =>
		new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.FORWARDS, {
					jumpDelay,
					jumpSize: 1
				}),
				background,
				sequences: [new SingleColor(foreground)]
			})
		]),
	TWO_MOVING_DOTS: ({
		jumpDelay,
		foreground,
		background
	}: {
		jumpDelay: number;
		foreground: Color;
		background: Color;
	}) =>
		new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.FORWARDS, {
					jumpDelay,
					jumpSize: 1
				}),
				background,
				sequences: [
					new SingleColor(foreground),
					new TransparentSequence(NUM_LEDS / 2 - 1),
					new SingleColor(foreground),
					new TransparentSequence(NUM_LEDS / 2 - 1)
				]
			})
		]),
	MOVING_RAINBOW: ({ jumpDelay }: { jumpDelay: number }) =>
		new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.FORWARDS, {
					jumpDelay,
					jumpSize: 1
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
						)
					])
					.toSequence()
			})
		]),
	RED: () =>
		new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.OFF),
				background: new Color(255, 0, 0),
				sequences: []
			})
		]),
	OFF: () =>
		new LedEffect([
			new LedSpecStep({
				moveData: new MoveData(MOVING_STATUS.OFF),
				background: new Color(0, 0, 0),
				sequences: []
			})
		])
} as const;
const typeGuard = EFFECTS as {
	[key: string]: (...args: any[]) => LedEffect;
};
typeGuard;

function main() {
	connect(getIO(), EFFECTS.OFF());
}

main();
