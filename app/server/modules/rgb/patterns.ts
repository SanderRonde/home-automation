import { CustomMode } from 'magic-home';

export type CustomPattern =
	| 'rgb'
	| 'rainbow'
	| 'christmas'
	| 'strobe'
	| 'darkcolors'
	| 'shittyfire'
	| 'betterfire';

export const patterns: {
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
