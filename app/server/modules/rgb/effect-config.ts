import { Color } from '../../lib/color';

export enum MOVING_STATUS {
	OFF = 0,
	FORWARDS = 1,
	BACKWARDS = 2,
}

function assert(condition: boolean, message: string) {
	if (!condition) {
		throw new Error(message);
	}
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

interface JSONAble {
	toJSON(): unknown;
}

export class MoveData implements JSONAble {
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

	public toJSON(): unknown {
		return {
			move_status: this._moving,
			jump_size: this._movingConfig.jumpSize,
			jump_delay: this._movingConfig.jumpDelay,
			alternate: ~~this._alternateConfig.alternate,
			alternate_delay: this._alternateConfig.alternate
				? this._alternateConfig.alternateDelay
				: 0,
		};
	}
}

export class ColorSequence implements JSONAble {
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

	public toJSON(): unknown {
		return {
			type: ColorType.COLOR_SEQUENCE,
			num_colors: this.colors.length,
			repetitions: this.repetitions,
			colors: this.colors.map((c) => c.toJSONArray()),
		};
	}
}

export class TransparentSequence implements JSONAble {
	public constructor(public length: number) {}

	public toJSON(): unknown {
		return {
			type: ColorType.TRANSPARENT,
			color: {
				size: this.length,
			},
		};
	}
}

export enum ColorType {
	SINGLE_COLOR = 0,
	COLOR_SEQUENCE = 1,
	RANDOM_COLOR = 2,
	TRANSPARENT = 3,
	REPEAT = 4,
}

export class SingleColor implements JSONAble {
	public get length(): number {
		return 1;
	}

	public constructor(public color: Color) {}

	public toJSON(): unknown {
		return {
			type: ColorType.SINGLE_COLOR,
			color: this.color.toJSONArray(),
		};
	}
}

export class RandomColor implements JSONAble {
	public constructor(
		public size: number,
		public randomTime: number,
		public randomEveryTime: boolean
	) {}

	public toJSON(): unknown {
		return {
			type: ColorType.RANDOM_COLOR,
			color: {
				random_every_time: this.randomEveryTime,
				random_time: this.randomTime,
				size: this.size,
			},
		};
	}
}

export class Repeat implements JSONAble {
	public constructor(
		public repetitions: number,
		public sequence:
			| SingleColor
			| ColorSequence
			| RandomColor
			| TransparentSequence
	) {}

	public toJSON(): unknown {
		return {
			type: ColorType.REPEAT,
			repetitions: this.repetitions,
			sequence: this.sequence.toJSON(),
		};
	}
}

export class LedSpecStep implements JSONAble {
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

	public toJSON(): unknown {
		return {
			delay_until_next: this.delayUntilNext,
			move_data: this.moveData.toJSON(),
			background: this.background.toJSONArray(),
			num_sequences: this.sequences
				.map((sequence) => {
					if (sequence instanceof Repeat) {
						return sequence.repetitions;
					}
					return 1;
				})
				.reduce((p, c) => p + c, 0),
			sequences: this.sequences.map((s) => s.toJSON()),
		};
	}
}

export class LedEffect implements JSONAble {
	public constructor(public effect: LedSpecStep[]) {}

	public toJSON(): unknown {
		return {
			num_steps: this.effect.length,
			steps: this.effect.map((e) => e.toJSON()),
		};
	}
}

export class LedSpec {
	public constructor(public steps: LedEffect) {}

	public toJSON(): unknown {
		return this.steps.toJSON();
	}
}
