import { SECRETS_FILE } from './constants';
import * as express from 'express';
import * as fs from 'fs-extra';

let key: string|null = null;
async function readSecret() {
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

let cookie: string|null = null;
async function genCookie() {
	if (cookie) return cookie;

	const key = await getKey();
	const reversedKey = key.split('').reverse().join('');

	const newKey: string[] = [];
	for (let i = 0 ; i < key.length; i++) {
		newKey[i] = String.fromCharCode(key.charCodeAt(i) ^ reversedKey.charCodeAt(i));
	}
	return (cookie = newKey.join(''));
}

export async function checkCookie(req: express.Request) {
	return req.cookies['key'] && req.cookies['key'] === await genCookie();
}

export async function initAuthRoutes(app: express.Express) {
	await readSecret();
	app.all('/auth/:key', async (req, res) => {
		if (authenticate(req.params.key)) {
			res.cookie('key', await genCookie());
			res.status(200).write('Success');
		} else {
			res.status(403).write('Access denied');
		}
	});
}