#!/usr/bin/env bun
/* eslint-disable no-console */
import * as fs from 'fs-extra';
import * as path from 'path';

const ROOT = path.join(__dirname, '../');
const ICONS_FOLDER = path.join(ROOT, 'static/icons');

// House icon generator matching favicon.svg design
function generateIconSVG(size: number): string {
	const scale = size / 64; // Base design is 64x64
	const strokeWidth = 2 * scale;

	return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
	<defs>
		<linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
			<stop offset="0%" style="stop-color:#4A90E2;stop-opacity:1" />
			<stop offset="100%" style="stop-color:#357ABD;stop-opacity:1" />
		</linearGradient>
	</defs>
	<!-- House roof -->
	<path d="M ${32 * scale} ${8 * scale} L ${8 * scale} ${28 * scale} L ${12 * scale} ${28 * scale} L ${12 * scale} ${56 * scale} L ${52 * scale} ${56 * scale} L ${52 * scale} ${28 * scale} L ${56 * scale} ${28 * scale} Z" fill="url(#grad)" stroke="#2C5F8D" stroke-width="${strokeWidth}"/>
	<!-- Door -->
	<rect x="${26 * scale}" y="${40 * scale}" width="${12 * scale}" height="${16 * scale}" fill="#2C5F8D" rx="${1 * scale}"/>
	<!-- Window left -->
	<rect x="${16 * scale}" y="${32 * scale}" width="${8 * scale}" height="${8 * scale}" fill="#FFE082" rx="${1 * scale}"/>
	<!-- Window right -->
	<rect x="${40 * scale}" y="${32 * scale}" width="${8 * scale}" height="${8 * scale}" fill="#FFE082" rx="${1 * scale}"/>
	<!-- Door knob -->
	<circle cx="${35 * scale}" cy="${48 * scale}" r="${1 * scale}" fill="#FFE082"/>
</svg>`;
}

async function generateIcons() {
	console.log('📱 Generating PWA icons...');

	await fs.mkdirp(ICONS_FOLDER);

	const sizes = [192, 512];

	for (const size of sizes) {
		const svg = generateIconSVG(size);
		const outputPath = path.join(ICONS_FOLDER, `icon-${size}.svg`);
		await fs.writeFile(outputPath, svg);
		console.log(`✅ Generated icon-${size}.svg`);
	}

	console.log('\n💡 Note: For best results, convert these SVG files to PNG format.');
	console.log('   You can use: convert icon-192.svg icon-192.png');
	console.log('   Or use an online converter like: https://cloudconvert.com/svg-to-png');
}

void generateIcons();
