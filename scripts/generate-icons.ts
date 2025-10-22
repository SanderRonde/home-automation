#!/usr/bin/env bun
/* eslint-disable no-console */
import * as fs from 'fs-extra';
import * as path from 'path';

const ROOT = path.join(__dirname, '../');
const ICONS_FOLDER = path.join(ROOT, 'static/icons');

// Simple SVG icon generator
function generateIconSVG(size: number): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
	<defs>
		<linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
			<stop offset="0%" style="stop-color:#1976d2;stop-opacity:1" />
			<stop offset="100%" style="stop-color:#42a5f5;stop-opacity:1" />
		</linearGradient>
	</defs>
	<rect width="${size}" height="${size}" rx="${size * 0.15}" fill="url(#grad)"/>
	<path d="M ${size * 0.25} ${size * 0.35} L ${size * 0.5} ${size * 0.2} L ${size * 0.75} ${size * 0.35} L ${size * 0.75} ${size * 0.65} L ${size * 0.5} ${size * 0.8} L ${size * 0.25} ${size * 0.65} Z" fill="white"/>
	<circle cx="${size * 0.5}" cy="${size * 0.5}" r="${size * 0.1}" fill="#1976d2"/>
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
