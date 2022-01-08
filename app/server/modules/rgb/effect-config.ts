import { Color } from '../../lib/color';

const BYTE_BITS = 8;
const MAX_BYTE_VAL = Math.pow(2, BYTE_BITS) - 1;

export enum MOVING_STATUS {
	OFF = 0,
	FORWARDS = 1,
	BACKWARDS = 2,
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
		short & MAX_BYTE_VAL,
	];
}

export class Leds {
	private _leds!: (ColorSequence | SingleColor)[];

	public constructor(private readonly _numLeds: number) {}

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

	public fillWithColors(colors: Color[]): this {
		const numFullSequences = Math.floor(this._numLeds / colors.length);
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

	public toSequence(): (ColorSequence | SingleColor)[] {
		return this._leds;
	}
}

export class MoveData {
	public static readonly MOVING_STATUS = MOVING_STATUS;

	public constructor(
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
	public constructor(_moving: MOVING_STATUS.OFF);
	public constructor(
		private readonly _moving: MOVING_STATUS,
		private _movingConfig: {
			jumpSize: number;
			jumpDelay: number;
		} = {
			jumpSize: 0,
			jumpDelay: 0,
		},
		private _alternateConfig:
			| {
					alternate: true;
					alternateDelay: number;
			  }
			| {
					alternate: false;
			  } = {
			alternate: false,
		}
	) {}

	public toBytes(): number[] {
		return [
			this._moving,
			...shortToBytes(this._movingConfig.jumpSize),
			...shortToBytes(this._movingConfig.jumpDelay),
			~~this._alternateConfig.alternate,
			...shortToBytes(
				this._alternateConfig.alternate
					? this._alternateConfig.alternateDelay
					: 0
			),
		];
	}
}

export class ColorSequence {
	public colors: Color[];

	public get length(): number {
		return (
			(Array.isArray(this.colors) ? this.colors.length : 1) *
			this.repetitions
		);
	}

	public constructor(colors: Color[] | Color, public repetitions: number) {
		this.colors = Array.isArray(colors) ? colors : [colors];
	}

	public toBytes(): number[] {
		return [
			ColorType.COLOR_SEQUENCE,
			...shortToBytes(this.colors.length),
			...shortToBytes(this.repetitions),
			...flatten<number>(this.colors.map((color) => color.toBytes())),
		];
	}
}

export class TransparentSequence {
	public constructor(public length: number) {}

	public toBytes(): number[] {
		return [ColorType.TRANSPARENT, ...shortToBytes(this.length)];
	}
}

export enum ColorType {
	SINGLE_COLOR = 0,
	COLOR_SEQUENCE = 1,
	RANDOM_COLOR = 2,
	TRANSPARENT = 3,
	REPEAT = 4,
}

export class SingleColor {
	public get length(): number {
		return 1;
	}

	public constructor(public color: Color) {}

	public toBytes(): number[] {
		return [ColorType.SINGLE_COLOR, ...this.color.toBytes()];
	}
}

export class RandomColor {
	public constructor(
		public size: number,
		public randomTime: number,
		public randomEveryTime: boolean
	) {}

	public toBytes(): number[] {
		return [
			ColorType.RANDOM_COLOR,
			~~this.randomEveryTime,
			...shortToBytes(this.randomTime),
			...shortToBytes(this.size),
		];
	}
}

export class Repeat {
	public constructor(
		public repetitions: number,
		public sequence:
			| SingleColor
			| ColorSequence
			| RandomColor
			| TransparentSequence
	) {}

	public toBytes(): number[] {
		return [
			ColorType.REPEAT,
			...shortToBytes(this.repetitions),
			...this.sequence.toBytes(),
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

	public constructor(
		{
			background,
			moveData,
			sequences,
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

	public toBytes(): number[] {
		return [
			...shortToBytes(this.delayUntilNext),
			...this.moveData.toBytes(),
			...this.background.toBytes(),
			...shortToBytes(
				this.sequences
					.map((sequence) => {
						if (sequence instanceof Repeat) {
							return sequence.repetitions;
						}
						return 1;
					})
					.reduce((p, c) => p + c, 0)
			),
			...flatten(this.sequences.map((sequence) => sequence.toBytes())),
		];
	}
}

export class LedEffect {
	public constructor(public effect: LedSpecStep[]) {}

	public toBytes(): number[] {
		return [
			...shortToBytes(this.effect.length),
			...flatten(
				this.effect.map((step) => {
					return step.toBytes();
				})
			),
		];
	}
}

export class LedSpec {
	public constructor(public steps: LedEffect) {}

	public toBytes(): number[] {
		return ['<'.charCodeAt(0), ...this.steps.toBytes(), '>'.charCodeAt(0)];
	}
}
