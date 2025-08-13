import type { Color as MagicHomeColor } from 'magic-home';

interface IColor {
	r: number;
	g: number;
	b: number;
}
export class Color implements Color {
	public r: number;
	public g: number;
	public b: number;

	public constructor(color: number);
	public constructor(color: MagicHomeColor);
	public constructor(r: number, g: number, b: number);
	public constructor(
		r: number | MagicHomeColor,
		g: number = typeof r === 'number' ? r : 0,
		b: number = typeof r === 'number' ? r : 0
	) {
		if (typeof r !== 'number') {
			this.r = r.red;
			this.g = r.green;
			this.b = r.blue;
			return;
		}
		this.r = r;
		this.g = g;
		this.b = b;
	}

	public static fromHex(hexString: string): Color {
		const sliced = hexString.startsWith('#')
			? hexString.slice(1)
			: hexString;
		const [r, g, b] = sliced.match(/.{2}/g)!;
		return new Color(parseInt(r, 16), parseInt(g, 16), parseInt(b, 16));
	}

	public static fromHSV(
		hue: number,
		saturation: number,
		value: number
	): Color {
		const { r, g, b } = HSVtoRGB(hue, saturation, value);
		return new Color(r, g, b);
	}

	public static fromCieXy(x: number, y: number): Color {
		const { r, g, b } = cieXyToRgb(x, y);
		return new Color(r, g, b);
	}

	public static isSame(color1: Color, color2: Color): boolean {
		return (
			color1.r === color2.r &&
			color1.b === color2.b &&
			color1.g === color2.g
		);
	}

	private _colorToHex(color: number) {
		const num = color.toString(16);
		if (num.length === 1) {
			return `0${num}`;
		}
		return num;
	}

	public toJSON(): IColor {
		return {
			r: this.r,
			g: this.g,
			b: this.b,
		};
	}

	public toJSONArray(): number[] {
		return [this.r, this.g, this.b];
	}

	public clone(): Color {
		return new Color(this.r, this.g, this.b);
	}

	public toBytes(): number[] {
		return [this.r, this.g, this.b];
	}

	public isSame(color: Color): boolean {
		return Color.isSame(this, color);
	}

	public toHex(): string {
		return `#${this._colorToHex(this.r)}${this._colorToHex(
			this.g
		)}${this._colorToHex(this.b)}`;
	}

	public toDecimal(): number {
		return parseInt(this.toHex().slice(1), 16);
	}

	public toHSV(): {
		hue: number;
		saturation: number;
		value: number;
	} {
		const { h, s, v } = RGBToHSV(this.r, this.g, this.b);
		return {
			hue: h,
			saturation: s,
			value: v,
		};
	}

	public toCieXy(): { x: number; y: number } {
		const { x, y } = rgbToCieXy(this.r, this.g, this.b);
		return { x, y };
	}
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

function RGBToHSV(
	r: number,
	g: number,
	b: number
): {
	h: number;
	s: number;
	v: number;
} {
	const rAbsolute = r / 255;
	const gAbsolute = g / 255;
	const bAbsolute = b / 255;
	const value = Math.max(rAbsolute, gAbsolute, bAbsolute);
	const diff = value - Math.min(rAbsolute, gAbsolute, bAbsolute);
	const diffCalculator = (c: number) => (value - c) / 6 / diff + 1 / 2;

	const percentRoundFn = (num: number) => Math.round(num * 100) / 100;

	let h: number = 0;
	let s: number = 0;
	if (diff === 0) {
		h = s = 0;
	} else {
		s = diff / value;
		const rr = diffCalculator(rAbsolute);
		const gg = diffCalculator(gAbsolute);
		const bb = diffCalculator(bAbsolute);

		if (rAbsolute === value) {
			h = bb - gg;
		} else if (gAbsolute === value) {
			h = 1 / 3 + rr - bb;
		} else if (bAbsolute === value) {
			h = 2 / 3 + gg - rr;
		}
		if (h < 0) {
			h += 1;
		} else if (h > 1) {
			h -= 1;
		}
	}
	return {
		h: Math.round(h * 360),
		s: percentRoundFn(s * 100),
		v: percentRoundFn(value * 100),
	};
}

/**
 * Converts an RGB color to CIE 1931 x, y coordinates.
 * This is based on the sRGB color space and D65 white point.
 */
function rgbToCieXy(r: number, g: number, b: number): { x: number; y: number } {
	// Step 1: Normalize R, G, and B values to a 0-1 range.
	let red = r / 255;
	let green = g / 255;
	let blue = b / 255;

	// Step 2: Apply a gamma correction (sRGB to linear RGB).
	red = red > 0.04045 ? Math.pow((red + 0.055) / 1.055, 2.4) : red / 12.92;
	green =
		green > 0.04045
			? Math.pow((green + 0.055) / 1.055, 2.4)
			: green / 12.92;
	blue =
		blue > 0.04045 ? Math.pow((blue + 0.055) / 1.055, 2.4) : blue / 12.92;

	// Step 3: Convert from linear RGB to CIE XYZ using the sRGB D65 matrix.
	const X = red * 0.4124 + green * 0.3576 + blue * 0.1805;
	const Y = red * 0.2126 + green * 0.7152 + blue * 0.0722;
	const Z = red * 0.0193 + green * 0.1192 + blue * 0.9505;

	// Step 4: Convert from XYZ to xyY.
	let x = X / (X + Y + Z);
	let y = Y / (X + Y + Z);

	// Handle a case where X+Y+Z is zero, to avoid division by zero.
	if (isNaN(x)) {
		x = 0;
	}
	if (isNaN(y)) {
		y = 0;
	}

	return { x, y };
}

/**
 * Converts CIE 1931 x, y coordinates to an sRGB color.
 * This is the inverse of the rgbToCieXy function.
 * @param {number} x The CIE x coordinate (0-1).
 * @param {number} y The CIE y coordinate (0-1).
 * @returns {object} An object with r, g, and b properties (0-255).
 */
function cieXyToRgb(x: number, y: number): { r: number; g: number; b: number } {
	// Handle a case where y is zero to avoid division by zero.
	if (y === 0) {
		y = 0.0001;
	}

	const X = x / y;
	const Z = (1 - x - y) / y;

	// Step 2: Convert from XYZ to linear RGB using the sRGB D65 inverse matrix.
	let r_linear = X * 3.240479 - Z * 0.498535;
	let g_linear = X * -0.969256 + Z * 0.041556;
	let b_linear = X * 0.055648 + Z * 1.057311;

	// Step 3: Handle out-of-gamut colors by clamping.
	r_linear = Math.max(0, Math.min(1, r_linear));
	g_linear = Math.max(0, Math.min(1, g_linear));
	b_linear = Math.max(0, Math.min(1, b_linear));

	// Step 4: Apply inverse gamma correction (linear RGB to sRGB).
	const inverseGamma = (val: number) => {
		return val > 0.0031308
			? 1.055 * Math.pow(val, 1 / 2.4) - 0.055
			: val * 12.92;
	};

	const r_srgb = inverseGamma(r_linear);
	const g_srgb = inverseGamma(g_linear);
	const b_srgb = inverseGamma(b_linear);

	// Step 5: Denormalize to 0-255 and round.
	const r = Math.round(r_srgb * 255);
	const g = Math.round(g_srgb * 255);
	const b = Math.round(b_srgb * 255);

	return { r, g, b };
}export const colorList = {
	aliceblue: '#f0f8ff',
	antiquewhite: '#faebd7',
	aqua: '#00ffff',
	aquamarine: '#7fffd4',
	azure: '#f0ffff',
	beige: '#f5f5dc',
	bisque: '#ffe4c4',
	black: '#000000',
	blanchedalmond: '#ffebcd',
	blue: '#0000ff',
	blueviolet: '#8a2be2',
	brown: '#a52a2a',
	burlywood: '#deb887',
	cadetblue: '#5f9ea0',
	chartreuse: '#7fff00',
	chocolate: '#d2691e',
	coral: '#ff7f50',
	cornflowerblue: '#6495ed',
	cornsilk: '#fff8dc',
	crimson: '#dc143c',
	cyan: '#00ffff',
	darkblue: '#00008b',
	darkcyan: '#008b8b',
	darkgoldenrod: '#b8860b',
	darkgray: '#a9a9a9',
	darkgreen: '#006400',
	darkgrey: '#a9a9a9',
	darkkhaki: '#bdb76b',
	darkmagenta: '#8b008b',
	darkolivegreen: '#556b2f',
	darkorange: '#ff8c00',
	darkorchid: '#9932cc',
	darkred: '#8b0000',
	darksalmon: '#e9967a',
	darkseagreen: '#8fbc8f',
	darkslateblue: '#483d8b',
	darkslategray: '#2f4f4f',
	darkslategrey: '#2f4f4f',
	darkturquoise: '#00ced1',
	darkviolet: '#9400d3',
	deeppink: '#ff1493',
	deepskyblue: '#00bfff',
	dimgray: '#696969',
	dimgrey: '#696969',
	dodgerblue: '#1e90ff',
	firebrick: '#b22222',
	floralwhite: '#fffaf0',
	forestgreen: '#228b22',
	fuchsia: '#ff00ff',
	gainsboro: '#dcdcdc',
	ghostwhite: '#f8f8ff',
	gold: '#ffd700',
	goldenrod: '#daa520',
	gray: '#808080',
	green: '#008000',
	greenyellow: '#adff2f',
	grey: '#808080',
	honeydew: '#f0fff0',
	hotpink: '#ff69b4',
	indianred: '#cd5c5c',
	indigo: '#4b0082',
	ivory: '#fffff0',
	khaki: '#f0e68c',
	lavender: '#e6e6fa',
	lavenderblush: '#fff0f5',
	lawngreen: '#7cfc00',
	lemonchiffon: '#fffacd',
	lightblue: '#add8e6',
	lightcoral: '#f08080',
	lightcyan: '#e0ffff',
	lightgoldenrodyellow: '#fafad2',
	lightgray: '#d3d3d3',
	lightgreen: '#90ee90',
	lightgrey: '#d3d3d3',
	lightpink: '#ffb6c1',
	lightsalmon: '#ffa07a',
	lightseagreen: '#20b2aa',
	lightskyblue: '#87cefa',
	lightslategray: '#778899',
	lightslategrey: '#778899',
	lightsteelblue: '#b0c4de',
	lightyellow: '#ffffe0',
	lime: '#00ff00',
	limegreen: '#32cd32',
	linen: '#faf0e6',
	magenta: '#ff00ff',
	maroon: '#800000',
	mediumaquamarine: '#66cdaa',
	mediumblue: '#0000cd',
	mediumorchid: '#ba55d3',
	mediumpurple: '#9370db',
	mediumseagreen: '#3cb371',
	mediumslateblue: '#7b68ee',
	mediumspringgreen: '#00fa9a',
	mediumturquoise: '#48d1cc',
	mediumvioletred: '#c71585',
	midnightblue: '#191970',
	mintcream: '#f5fffa',
	mistyrose: '#ffe4e1',
	moccasin: '#ffe4b5',
	navajowhite: '#ffdead',
	navy: '#000080',
	oldlace: '#fdf5e6',
	olive: '#808000',
	olivedrab: '#6b8e23',
	orange: '#ffa500',
	orangered: '#ff4500',
	orchid: '#da70d6',
	palegoldenrod: '#eee8aa',
	palegreen: '#98fb98',
	paleturquoise: '#afeeee',
	palevioletred: '#db7093',
	papayawhip: '#ffefd5',
	peachpuff: '#ffdab9',
	peru: '#cd853f',
	pink: '#ffc0cb',
	plum: '#dda0dd',
	powderblue: '#b0e0e6',
	purple: '#800080',
	rebeccapurple: '#663399',
	red: '#ff0000',
	rosybrown: '#bc8f8f',
	royalblue: '#4169e1',
	saddlebrown: '#8b4513',
	salmon: '#fa8072',
	sandybrown: '#f4a460',
	seagreen: '#2e8b57',
	seashell: '#fff5ee',
	sienna: '#a0522d',
	silver: '#c0c0c0',
	skyblue: '#87ceeb',
	slateblue: '#6a5acd',
	slategray: '#708090',
	slategrey: '#708090',
	snow: '#fffafa',
	springgreen: '#00ff7f',
	steelblue: '#4682b4',
	tan: '#d2b48c',
	teal: '#008080',
	thistle: '#d8bfd8',
	tomato: '#ff6347',
	turquoise: '#40e0d0',
	violet: '#ee82ee',
	wheat: '#f5deb3',
	white: '#ffffff',
	whitesmoke: '#f5f5f5',
	yellow: '#ffff00',
	yellowgreen: '#9acd32',
};

