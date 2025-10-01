import { getClientSecret } from '../modules/auth/client-secret';
import { verifyCookie } from '../modules/auth/cookie';
import { Auth } from '../modules/auth';
import type { BunRequest } from 'bun';

export async function checkAuth(req: BunRequest): Promise<boolean> {
	// Check session cookie first (new auth method)
	const sessionId = req.cookies.get('session');
	if (sessionId) {
		const userManagement = await Auth.userManagement;
		const user = await userManagement.verifySession(sessionId);
		if (user) {
			return true;
		}
	}

	// Check old key-based cookie auth
	if (req.cookies.has('key')) {
		if (verifyCookie(req.cookies.get('key')!)) {
			return true;
		}
		return false;
	}

	// Check query parameter auth
	const queryParams = new URL(req.url).searchParams;
	if (
		queryParams.has('auth') &&
		getClientSecret(parseInt(queryParams.get('id') ?? '0', 10)) === queryParams.get('auth')!
	) {
		return true;
	}
	return false;
}
