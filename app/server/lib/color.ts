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

	constructor(color: number);
	constructor(color: MagicHomeColor);
	constructor(r: number, g: number, b: number);
	constructor(
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

	private _colorToHex(color: number) {
		const num = color.toString(16);
		if (num.length === 1) {
			return `0${num}`;
		}
		return num;
	}

	toJSON(): IColor {
		return {
			r: this.r,
			g: this.g,
			b: this.b,
		};
	}

	clone(): Color {
		return new Color(this.r, this.g, this.b);
	}

	toBytes(): number[] {
		return [this.r, this.g, this.b];
	}

	isSame(color: Color): boolean {
		return Color.isSame(this, color);
	}

	toHex(): string {
		return `#${this._colorToHex(this.r)}${this._colorToHex(
			this.g
		)}${this._colorToHex(this.b)}`;
	}

	toDecimal(): number {
		return parseInt(this.toHex().slice(1), 16);
	}

	static fromHex(hexString: string): Color {
		const sliced = hexString.startsWith('#')
			? hexString.slice(1)
			: hexString;
		const [r, g, b] = sliced.match(/.{2}/g)!;
		return new Color(parseInt(r, 16), parseInt(g, 16), parseInt(b, 16));
	}

	static fromHSV(hue: number, saturation: number, value: number): Color {
		const { r, g, b } = HSVtoRGB(hue, saturation, value);
		return new Color(r, g, b);
	}

	static isSame(color1: Color, color2: Color): boolean {
		return (
			color1.r === color2.r &&
			color1.b === color2.b &&
			color1.g === color2.g
		);
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