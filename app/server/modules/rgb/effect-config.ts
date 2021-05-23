import { Color } from '../../lib/types';

export namespace RGBEffectConfig {
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

		fillWithColors(colors: Color[]): this {
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

		toSequence(): (ColorSequence | SingleColor)[] {
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

		toBytes(): number[] {
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

		constructor(colors: Color[] | Color, public repetitions: number) {
			this.colors = Array.isArray(colors) ? colors : [colors];
		}

		toBytes(): number[] {
			return [
				ColorType.COLOR_SEQUENCE,
				...shortToBytes(this.colors.length),
				...shortToBytes(this.repetitions),
				...flatten<number>(this.colors.map((color) => color.toBytes())),
			];
		}

		get length(): number {
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
		REPEAT = 4,
	}

	export class SingleColor {
		constructor(public color: Color) {}

		toBytes(): number[] {
			return [ColorType.SINGLE_COLOR, ...this.color.toBytes()];
		}

		get length(): number {
			return 1;
		}
	}

	export class RandomColor {
		constructor(
			public size: number,
			public randomTime: number,
			public randomEveryTime: boolean
		) {}

		toBytes(): number[] {
			return [
				ColorType.RANDOM_COLOR,
				~~this.randomEveryTime,
				...shortToBytes(this.randomTime),
				...shortToBytes(this.size),
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

		toBytes(): number[] {
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

		constructor(
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

		toBytes(): number[] {
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
				...flatten(
					this.sequences.map((sequence) => sequence.toBytes())
				),
			];
		}
	}

	export class LedEffect {
		constructor(public effect: LedSpecStep[]) {}

		toBytes(): number[] {
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
		constructor(public steps: LedEffect) {}

		toBytes(): number[] {
			return [
				'<'.charCodeAt(0),
				...this.steps.toBytes(),
				'>'.charCodeAt(0),
			];
		}
	}
}
