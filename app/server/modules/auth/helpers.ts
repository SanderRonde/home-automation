import { authenticate } from './client-secret';
import { checkCookie } from './cookie';
import { redact } from './secret';

export function externalRedact(text: string): string {
	return redact(text);
}

export function externalAuthenticate(authKey: string, id: string): boolean {
	return authenticate(authKey, id);
}

export function externalCheckCookie(req: {
	cookies: {
		[key: string]: string;
	};
}): boolean {
	return checkCookie(req);
}
