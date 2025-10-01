import { createServeOptions, withRequestBody } from '../../lib/routes';
import loginHtml from '../../../client/login/index.html';
import type { UserManagement } from './user-management';
import { serveStatic } from '../../lib/serve-static';
import type { ServeOptions } from '../../lib/routes';
import { CLIENT_FOLDER } from '../../lib/constants';
import { authenticate } from './secret';
import { genCookie } from './cookie';
import * as path from 'path';
import * as z from 'zod';

async function _getRoutes(userManagement: UserManagement) {
	return createServeOptions(
		{
			'/login-page': loginHtml,
			...(await serveStatic(path.join(CLIENT_FOLDER, 'login'), 'login')),
			// Keep the old key-based auth for backwards compatibility
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
			'/login': {
				POST: withRequestBody(
					z.object({
						username: z.string().min(1),
						password: z.string().min(1),
					}),
					async (body, req, _server, { json, error }) => {
						try {
							const user = await userManagement.verifyCredentials(
								body.username,
								body.password
							);

							if (!user) {
								return error('Invalid username or password', 401);
							}

							// Create session
							const sessionId = await userManagement.createSession(user.id);

							// Set session cookie
							req.cookies.set('session', sessionId, {
								httpOnly: true,
								secure: false, // Set to true if using HTTPS
								sameSite: 'lax',
								expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
							});

							return json({
								success: true,
								username: user.username,
							});
						} catch (e) {
							if (e instanceof z.ZodError) {
								return error('Invalid request body', 400);
							}
							return error('Internal server error', 500);
						}
					}
				),
			},
			'/logout': {
				POST: async (req, _server, { json }) => {
					const sessionId = req.cookies.get('session');
					if (sessionId) {
						await userManagement.deleteSession(sessionId);
						req.cookies.delete('session');
					}

					return json({ success: true });
				},
			},
			'/me': {
				GET: async (req, _server, { json, error }) => {
					const sessionId = req.cookies.get('session');
					if (!sessionId) {
						return error('Not authenticated', 401);
					}

					const user = await userManagement.verifySession(sessionId);
					if (!user) {
						return error('Session invalid or expired', 401);
					}

					return json({
						username: user.username,
						id: user.id,
					});
				},
			},
		},
		false
	);
}

export const getRoutes = _getRoutes as (
	userManagement: UserManagement
) => Promise<ServeOptions<unknown>>;

export type AuthRoutes =
	Awaited<ReturnType<typeof _getRoutes>> extends ServeOptions<infer R> ? R : never;
