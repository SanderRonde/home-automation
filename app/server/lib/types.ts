export interface IColor {
	r: number;
	g: number;
	b: number;
}
export class Color implements Color {
	public r: number;
	public g: number;
	public b: number;

	constructor(r: number);
	constructor(r: number, g: number, b: number);
	constructor(r: number, g: number = r, b: number = r) {
		this.r = r;
		this.g = g;
		this.b = b;
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

	static isSame(color1: Color, color2: Color): boolean {
		return (
			color1.r === color2.r &&
			color1.b === color2.b &&
			color1.g === color2.g
		);
	}
}
