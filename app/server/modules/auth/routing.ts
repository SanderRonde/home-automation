import { createRoutes } from '../../lib/routes';
import type { Routes } from '../../lib/routes';
import { authenticate } from './secret';
import { genCookie } from './cookie';

export function getRoutes(): Routes {
	return createRoutes({
		'/key/:key': (req) => {
			if (authenticate(req.params.key)) {
				req.cookies.set('key', genCookie(), {
					// Expires in quite a few years
					expires: new Date(2147483647000),
				});
				return new Response('Success', { status: 200 });
			} else {
				return new Response('Access denied', { status: 403 });
			}
		},
	});
}
