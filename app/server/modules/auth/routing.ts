import { createServeOptions } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import { authenticate } from './secret';
import { genCookie } from './cookie';

function _getRoutes() {
	return createServeOptions({
		'/key/:key': (req, _server, { json }) => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			if (authenticate(req.params.key)) {
				req.cookies.set('key', genCookie(), {
					// Expires in quite a few years
					expires: new Date(2147483647000),
				});
				return json('Success', { status: 200 });
			} else {
				return json('Access denied', { status: 403 });
			}
		},
	});
}

export const getRoutes = _getRoutes as () => ServeOptions<unknown>;

export type AuthRoutes =
	ReturnType<typeof _getRoutes> extends ServeOptions<infer R> ? R : never;
