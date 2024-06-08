import type { TransitionTypes } from 'magic-home';
import type { Color } from '../../lib/color';

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

export type JoinedConfigs = Partial<Solid & Dot & Split & Pattern & Flash>;
