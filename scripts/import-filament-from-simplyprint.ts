/**
 * Imports or removes transcribed SimplyPrint filament data from scripts/simplyprint-filaments.json.
 * Run from project root:
 *   bun run scripts/import-filament-from-simplyprint.ts [--dry-run]   # import
 *   bun run scripts/import-filament-from-simplyprint.ts --remove [--dry-run]   # remove imported spools
 */
/* eslint-disable no-console */
import type { FilamentDB } from '../app/server/modules/filament/index';
import { FilamentAPI } from '../app/server/modules/filament/api';
import { DB_FOLDER } from '../app/server/lib/constants';
import type { FilamentType } from '../types/filament';
import { FILAMENT_TYPES } from '../types/filament';
import { Database } from '../app/server/lib/db';
import { SQL } from 'bun';
import path from 'path';

interface TranscribedRow {
	name: string;
	brandMaterial: string;
	maxWeight: number;
	percentage: number;
}

const NAME_TO_HEX: Record<string, string> = {
	'black gold': '#b8860b',
	beige: '#d7ccc8',
	red: '#e53935',
	'green / blue': '#1e88e5',
	'cyan / white': '#00bcd4',
	yellow: '#fdd835',
	cyan: '#00bcd4',
	transparent: '#e0e0e0',
	blue: '#1e88e5',
	'orange / black': '#fb8c00',
	'jade white': '#a7c4a0',
	purple: '#8e24aa',
	orange: '#fb8c00',
	black: '#212121',
	grey: '#9e9e9e',
	gray: '#9e9e9e',
	'cocoa brown': '#6d4c41',
	'maroon red': '#b71c1c',
	'indigo purple': '#4a148c',
	'alpine green sparkle': '#43a047',
	'bambu green': '#2e7d32',
	white: '#fafafa',
	green: '#43a047',
	brown: '#6d4c41',
};

function colorFromName(name: string): string {
	const key = name.toLowerCase().trim();
	return NAME_TO_HEX[key] ?? '#808080';
}

function typeFromBrandMaterial(brandMaterial: string): FilamentType {
	const upper = brandMaterial.toUpperCase();
	for (const t of FILAMENT_TYPES) {
		if (t === 'OTHER') {
			continue;
		}
		if (upper.includes(t)) {
			return t;
		}
	}
	return 'OTHER';
}

const DATA_PATH = path.join(process.cwd(), 'scripts', 'simplyprint-filaments.json');

async function main() {
	const dryRun = process.argv.includes('--dry-run');
	const remove = process.argv.includes('--remove');

	const file = Bun.file(DATA_PATH);
	if (!(await file.exists())) {
		console.error('Data file not found:', DATA_PATH);
		process.exit(1);
	}
	const rows = (await file.json()) as TranscribedRow[];
	if (!Array.isArray(rows)) {
		console.error('Data file must be a JSON array');
		process.exit(1);
	}

	const importedSpecialProperties = new Set(rows.map((r) => `${r.name} - ${r.brandMaterial}`));

	if (remove) {
		const db = new Database<FilamentDB>('filament.json');
		const sqlDB = new SQL(`sqlite://${path.join(DB_FOLDER, 'filament')}.db`);
		const api = new FilamentAPI(db, sqlDB);
		const allSpools = api.listSpools();
		const toRemove = allSpools.filter(
			(s) => s.specialProperties && importedSpecialProperties.has(s.specialProperties)
		);
		if (dryRun) {
			console.log('Dry run: would remove', toRemove.length, 'spools\n');
			for (const s of toRemove) {
				console.log(`  ${s.id} | ${s.specialProperties}`);
			}
			return;
		}
		for (const s of toRemove) {
			api.deleteSpool(s.id);
			console.log('Removed:', s.id, '|', s.specialProperties);
		}
		console.log('Removed', toRemove.length, 'spools.');
		return;
	}

	if (dryRun) {
		console.log('Dry run: would import', rows.length, 'spools\n');
		for (let i = 0; i < rows.length; i++) {
			const r = rows[i];
			const color = colorFromName(r.name);
			const type = typeFromBrandMaterial(r.brandMaterial);
			const specialProperties = `${r.name} - ${r.brandMaterial}`;
			console.log(
				`  ${i + 1}. ${r.name} | ${r.brandMaterial} | ${r.maxWeight}g | ${r.percentage}% | color=${color} type=${type}`
			);
			console.log(`     specialProperties: ${specialProperties}`);
		}
		return;
	}

	const db = new Database<FilamentDB>('filament.json');
	const sqlDB = new SQL(`sqlite://${path.join(DB_FOLDER, 'filament')}.db`);
	const api = new FilamentAPI(db, sqlDB);

	for (const r of rows) {
		const color = colorFromName(r.name);
		const type = typeFromBrandMaterial(r.brandMaterial);
		const specialProperties = `${r.name} - ${r.brandMaterial}`;
		const id = api.createSpool({
			color,
			type,
			specialProperties,
			maxWeight: r.maxWeight,
			percentage: r.percentage,
		});
		console.log('Created:', id, '|', r.name, '|', r.brandMaterial);
	}
	console.log('Imported', rows.length, 'spools.');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
