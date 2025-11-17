import { genId, getClientSecret } from './client-secret';

export function genCookie(): string {
	const id = genId();
	const clientSecret = getClientSecret(id);

	return JSON.stringify([id, clientSecret]);
}

export function verifyCookie(cookie: string): boolean {
	const parsed = JSON.parse(cookie);
	if (!parsed || !Array.isArray(parsed) || parsed.length !== 2) {
		return false;
	}
	if (typeof parsed[0] !== 'number' || typeof parsed[1] !== 'string') {
		return false;
	}

	return getClientSecret(parsed[0]) === parsed[1];
}
