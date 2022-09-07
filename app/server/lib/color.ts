import { Color as MagicHomeColor } from 'magic-home';

export interface IColor {
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
