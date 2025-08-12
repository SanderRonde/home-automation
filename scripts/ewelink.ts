import { initEWeLinkDevices } from '../app/server/modules/ewelink/api';
import { logReady } from '../app/server/lib/logging/logger';
import eWelink from 'ewelink-api-next';

async function main() {
	let appId: string | undefined;
	let appSecret: string | undefined;
	let region: string | undefined;
	let token: string | undefined;

	for (let i = 0; i < process.argv.length; i++) {
		const arg = process.argv[i];
		if (arg === '--app-id') {
			appId = process.argv[i + 1];
		}
		if (arg === '--app-secret') {
			appSecret = process.argv[i + 1];
		}
		if (arg === '--region') {
			region = process.argv[i + 1];
		}
		if (arg === '--token') {
			token = process.argv[i + 1];
		}
	}

	if (!appId || !appSecret || !region || !token) {
		console.error('Missing required arguments');
		throw new Error('Missing required arguments');
	}

	logReady();
	const api = new eWelink.WebAPI({
		appId,
		appSecret,
		region,
	});
	api.at = token;
	await initEWeLinkDevices(api);
}

// @ts-ignore
await main();
