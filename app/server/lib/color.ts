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
}
