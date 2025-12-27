/**
 * Convert Kelvin color temperature to RGB using a more accurate algorithm.
 * Based on the Planckian locus approximation.
 */
export function kelvinToRgb(kelvin: number): { r: number; g: number; b: number } {
	// Clamp to typical range
	const temp = Math.max(2000, Math.min(6500, kelvin));
	const temp100 = temp / 100;

	let r: number;
	let g: number;
	let b: number;

	// Red channel
	if (temp <= 6600) {
		r = 255;
	} else {
		r = temp100 - 60;
		r = 329.698727446 * Math.pow(r, -0.1332047592);
		r = Math.max(0, Math.min(255, r));
	}

	// Green channel
	if (temp <= 6600) {
		g = temp100 - 2;
		g = 99.4708025861 * Math.log(g) - 161.1195681661;
		g = Math.max(0, Math.min(255, g));
	} else {
		g = temp100 - 60;
		g = 288.1221695283 * Math.pow(g, -0.0755148492);
		g = Math.max(0, Math.min(255, g));
	}

	// Blue channel
	if (temp >= 6600) {
		b = 255;
	} else if (temp <= 2000) {
		b = 0;
	} else {
		b = temp100 - 10;
		b = 138.5177312231 * Math.log(b) - 305.0447927307;
		b = Math.max(0, Math.min(255, b));
	}

	return {
		r: Math.round(r),
		g: Math.round(g),
		b: Math.round(b),
	};
}

/**
 * Convert RGB to HSV with normalized values (0-1 for all components).
 */
export function rgbToHsv(
	r: number,
	g: number,
	b: number
): { hue: number; saturation: number; value: number } {
	const rAbsolute = r / 255;
	const gAbsolute = g / 255;
	const bAbsolute = b / 255;
	const max = Math.max(rAbsolute, gAbsolute, bAbsolute);
	const min = Math.min(rAbsolute, gAbsolute, bAbsolute);
	const delta = max - min;

	let hue = 0;
	if (delta !== 0) {
		if (max === rAbsolute) {
			hue = ((gAbsolute - bAbsolute) / delta) % 6;
		} else if (max === gAbsolute) {
			hue = (bAbsolute - rAbsolute) / delta + 2;
		} else {
			hue = (rAbsolute - gAbsolute) / delta + 4;
		}
		hue = hue * 60;
		if (hue < 0) {
			hue += 360;
		}
	}

	const saturation = max === 0 ? 0 : delta / max;
	const value = max;

	return {
		hue: hue / 360, // Normalize to 0-1
		saturation,
		value,
	};
}

export const hsvToHex = (h: number, s: number, v: number): string => {
	const hNorm = h / 360;
	const sNorm = s / 100;
	const vNorm = v / 100;

	const i = Math.floor(hNorm * 6);
	const f = hNorm * 6 - i;
	const p = vNorm * (1 - sNorm);
	const q = vNorm * (1 - f * sNorm);
	const t = vNorm * (1 - (1 - f) * sNorm);

	let r: number, g: number, b: number;
	switch (i % 6) {
		case 0:
			r = vNorm;
			g = t;
			b = p;
			break;
		case 1:
			r = q;
			g = vNorm;
			b = p;
			break;
		case 2:
			r = p;
			g = vNorm;
			b = t;
			break;
		case 3:
			r = p;
			g = q;
			b = vNorm;
			break;
		case 4:
			r = t;
			g = p;
			b = vNorm;
			break;
		case 5:
			r = vNorm;
			g = p;
			b = q;
			break;
		default:
			r = 0;
			g = 0;
			b = 0;
	}

	const toHex = (n: number) => {
		const hex = Math.round(n * 255).toString(16);
		return hex.length === 1 ? '0' + hex : hex;
	};

	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};
