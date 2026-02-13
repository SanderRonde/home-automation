/**
 * Parse ANSI escape sequences (e.g. from chalk) into segments for colored React rendering.
 * Supports SGR codes: 0 (reset), 1 (bold), 30-37 (foreground), 90-97 (bright foreground),
 * 38;5;n (256 color), 38;2;r;g;b (24-bit RGB).
 */

const ESC = String.fromCodePoint(0x1b);
const ANSI_RE = new RegExp(`${ESC}\\[([0-9;]*)m`, 'g');

/** 4-bit standard colors (30-37), mapped for dark background (grey.900) */
const FG_30_37: Record<number, string> = {
	30: '#808080', // black -> grey
	31: '#f44336', // red
	32: '#4caf50', // green
	33: '#ffeb3b', // yellow
	34: '#2196f3', // blue
	35: '#e91e8c', // magenta
	36: '#00bcd4', // cyan
	37: '#e0e0e0', // white
};

/** Bright foreground (90-97) */
const FG_90_97: Record<number, string> = {
	90: '#9e9e9e',
	91: '#e57373',
	92: '#81c784',
	93: '#ffd54f',
	94: '#64b5f6',
	95: '#ce93d8',
	96: '#4dd0e1',
	97: '#ffffff',
};

export interface AnsiSegment {
	text: string;
	color?: string;
	fontWeight?: string;
}

function parseSgr(codes: number[]): { color?: string; bold?: boolean } {
	let color: string | undefined;
	let bold = false;
	let i = 0;
	while (i < codes.length) {
		const c = codes[i];
		if (c === 0) {
			color = undefined;
			bold = false;
		} else if (c === 1) {
			bold = true;
		} else if (c >= 30 && c <= 37) {
			color = FG_30_37[c];
		} else if (c >= 90 && c <= 97) {
			color = FG_90_97[c];
		} else if (c === 38 && codes[i + 1] === 5 && codes[i + 2] !== undefined) {
			// 256-color: 38;5;n
			const n = codes[i + 2];
			color = ansi256ToHex(n);
			i += 2;
		} else if (
			c === 38 &&
			codes[i + 1] === 2 &&
			codes[i + 3] !== undefined &&
			codes[i + 4] !== undefined
		) {
			// 24-bit: 38;2;r;g;b
			const r = codes[i + 2];
			const g = codes[i + 3];
			const b = codes[i + 4];
			color = `rgb(${r},${g},${b})`;
			i += 4;
		} else if (c === 39) {
			color = undefined;
		}
		i += 1;
	}
	return { color, bold };
}

/** Convert ANSI 256 color index to hex (simple cube + grey ramp). */
function ansi256ToHex(n: number): string {
	if (n >= 232 && n <= 255) {
		const t = (n - 232) * 10 + 8;
		const v = t.toString(16).padStart(2, '0');
		return `#${v}${v}${v}`;
	}
	if (n >= 16 && n <= 231) {
		const x = n - 16;
		const r = Math.floor(x / 36);
		const g = Math.floor((x % 36) / 6);
		const b = x % 6;
		const toHex = (v: number) => (v === 0 ? '00' : (v * 40 + 55).toString(16).padStart(2, '0'));
		return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
	}
	// 0-15: standard colors (reuse 30-37 / 90-97 mapping)
	const standard = [
		'#000000',
		'#c62828',
		'#2e7d32',
		'#f9a825',
		'#1565c0',
		'#6a1b9a',
		'#00838f',
		'#e0e0e0',
		'#616161',
		'#ef5350',
		'#66bb6a',
		'#ffee58',
		'#42a5f5',
		'#ab47bc',
		'#26c6da',
		'#ffffff',
	];
	return standard[n] ?? '#e0e0e0';
}

/**
 * Parse a single line that may contain ANSI escape sequences into segments
 * suitable for rendering with React (each segment can be a span with color/bold).
 */
export function parseAnsiLine(line: string): AnsiSegment[] {
	const segments: AnsiSegment[] = [];
	let lastIndex = 0;
	let currentColor: string | undefined;
	let currentBold = false;
	let match: RegExpExecArray | null;
	ANSI_RE.lastIndex = 0;
	while ((match = ANSI_RE.exec(line)) !== null) {
		const text = line.slice(lastIndex, match.index);
		if (text.length > 0) {
			segments.push({
				text,
				...(currentColor && { color: currentColor }),
				...(currentBold && { fontWeight: 'bold' }),
			});
		}
		const codeStr = match[1];
		if (codeStr.length > 0) {
			const codes = codeStr.split(';').map((s) => parseInt(s, 10));
			const next = parseSgr(codes);
			if (next.color !== undefined) {
				currentColor = next.color;
			} else if (codes.includes(0)) {
				currentColor = undefined;
			}
			if (next.bold !== undefined) {
				currentBold = next.bold;
			}
			if (codes.includes(0)) {
				currentBold = false;
			}
		} else {
			// ESC[m = reset
			currentColor = undefined;
			currentBold = false;
		}
		lastIndex = match.index + match[0].length;
	}
	const tail = line.slice(lastIndex);
	if (tail.length > 0) {
		segments.push({
			text: tail,
			...(currentColor && { color: currentColor }),
			...(currentBold && { fontWeight: 'bold' }),
		});
	}
	return segments;
}
