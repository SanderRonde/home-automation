#!/usr/bin/env bun
/* eslint-disable no-console */
/* eslint-disable n/no-process-exit */
import * as fs from 'fs-extra';
import * as path from 'path';

const ROOT = path.join(__dirname, '../');
const CLIENT_FOLDER = path.join(ROOT, 'app/client');
const BUILD_FOLDER = path.join(ROOT, 'build/client');

async function buildDashboard() {
	console.log('🏗️  Building dashboard...');

	// Clean build folder
	await fs.remove(path.join(BUILD_FOLDER, 'dashboard'));
	await fs.mkdirp(path.join(BUILD_FOLDER, 'dashboard'));

	// Build main dashboard bundle
	const result = await Bun.build({
		entrypoints: [path.join(CLIENT_FOLDER, 'dashboard/dashboard.tsx')],
		outdir: path.join(BUILD_FOLDER, 'dashboard'),
		target: 'browser',
		minify: true,
		splitting: true,
		sourcemap: 'external',
		naming: {
			entry: '[dir]/[name].[hash].[ext]',
			chunk: '[dir]/[name].[hash].[ext]',
			asset: '[dir]/[name].[hash].[ext]',
		},
	});

	if (!result.success) {
		console.error('❌ Dashboard build failed:');
		for (const log of result.logs) {
			console.error(log);
		}
		process.exit(1);
	}

	// Build service worker separately (no code splitting)
	const swResult = await Bun.build({
		entrypoints: [path.join(CLIENT_FOLDER, 'dashboard/service-worker.ts')],
		outdir: path.join(BUILD_FOLDER, 'dashboard'),
		target: 'browser',
		minify: true,
		splitting: false,
		sourcemap: 'external',
		naming: 'service-worker.js',
	});

	if (!swResult.success) {
		console.error('❌ Service worker build failed:');
		for (const log of swResult.logs) {
			console.error(log);
		}
		process.exit(1);
	}

	// Copy static assets
	await Bun.write(
		Bun.file(path.join(BUILD_FOLDER, 'dashboard/manifest.json')),
		Bun.file(path.join(CLIENT_FOLDER, 'dashboard/manifest.json'))
	);

	// Create a manifest of built files for the server to reference
	const manifest: Record<string, string> = {};
	for (const output of result.outputs) {
		const relativePath = path.relative(path.join(BUILD_FOLDER, 'dashboard'), output.path);
		if (relativePath.startsWith('dashboard.') && relativePath.endsWith('.js')) {
			manifest['dashboard.tsx'] = relativePath;
		}
	}
	manifest['service-worker.js'] = 'service-worker.js';

	await Bun.write(
		Bun.file(path.join(BUILD_FOLDER, 'dashboard/build-manifest.json')),
		JSON.stringify(manifest, null, 2)
	);

	let index = await Bun.file(path.join(CLIENT_FOLDER, 'dashboard/index.html')).text();
	for (const [key, value] of Object.entries(manifest)) {
		index = index.replace(key, value);
	}
	await Bun.write(Bun.file(path.join(BUILD_FOLDER, 'dashboard/index.html')), index);

	console.log('✅ Dashboard built successfully!');
	console.log(`   Main bundle: ${manifest['dashboard.tsx']}`);
	console.log(`   Service worker: ${manifest['service-worker.js']}`);
}

async function main() {
	try {
		await buildDashboard();
	} catch (error) {
		console.error('❌ Build failed:', error);
		process.exit(1);
	}
}

void main();
