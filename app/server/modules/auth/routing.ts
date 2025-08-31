import { createServeOptions } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import { authenticate } from './secret';
import { genCookie } from './cookie';

export function getRoutes(): ServeOptions {
	return createServeOptions({
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
