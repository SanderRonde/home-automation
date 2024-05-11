import { authenticate } from '@server/modules/auth/client-secret';
import { checkCookie } from '@server/modules/auth/cookie';
import { redact } from '@server/modules/auth/secret';

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
