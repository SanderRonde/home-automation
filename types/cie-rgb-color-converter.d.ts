declare module 'cie-rgb-color-converter' {
	export function rgbToXy(
		r: number,
		g: number,
		b: number,
		modelId?: string
	): { x: number; y: number };
	export function xyBriToRgb(
		x: number,
		y: number,
		bri: number
	): { r: number; g: number; b: number };
}
