import { Api } from 'node-hue-api/dist/esm/api/Api';
import { logTag } from '../../lib/logging/logger';
import * as hue from 'node-hue-api';

export async function createUser(): Promise<void> {
	const results = await hue.discovery.nupnpSearch();
	if (!results.length) {
		logTag('Hue', 'red', 'No bridges found');
		return;
	}
	const unauthenticatedApi = await hue.api
		.createLocal(results[0].ipaddress)
		.connect();
	logTag(
		'hue',
		'blue',
		await unauthenticatedApi.users.createUser('home-automation')
	);
}

export async function discoverBridge(username: string): Promise<Api | null> {
	const results = await hue.discovery.nupnpSearch();
	if (!results.length) {
		return null;
	}
	return hue.api.createLocal(results[0].ipaddress).connect(username);
}
