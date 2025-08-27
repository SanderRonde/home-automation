import { getClientSecret } from '../modules/auth/client-secret';
import { verifyCookie } from '../modules/auth/cookie';
import type { BunRequest } from 'bun';

export function auth(req: BunRequest): boolean {
	if (req.cookies.has('key')) {
		if (verifyCookie(req.cookies.get('key')!)) {
			return true;
		}
		return false;
	}
	const queryParams = new URL(req.url).searchParams;
	if (!queryParams.has('auth')) {
		return false;
	}
	if (
		getClientSecret(parseInt(queryParams.get('id') ?? '0', 10)) ===
		queryParams.get('auth')!
	) {
		return true;
	}
	return false;
}
