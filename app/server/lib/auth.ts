import { SECRETS_FILE } from './constants';
import * as fs from 'fs-extra';

let key: string|null = null;
export async function readSecret() {
	if (!(await fs.pathExists(SECRETS_FILE))) {
		console.log('Missing auth file');
		process.exit(1);
	}

	return (key = await fs.readFile(SECRETS_FILE, {
		encoding: 'utf8'
	}));
}

export function authenticate(authKey: string) {
	return key === authKey;
}

export async function sanitize(data: string) {
	return data.replace(await getKey(), '[redacted]');
}

export async function getKey() {
	return key || await readSecret();
}