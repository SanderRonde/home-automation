import { authCode, authenticateURL, getEvents, getCalendar } from './calendar';
import { createServeOptions, staticResponse } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import type { BunRequest } from 'bun';

function _initRouting() {
	return createServeOptions(
		{
			'/authorize': async (req: BunRequest) => {
				const getParams = new URL(req.url).searchParams;
				const code = getParams.get('code');
				if (code) {
					await authCode(code);
				}

				return staticResponse(Response.redirect('/dashboard#home-kiosk'));
			},
			'/calendar': async (_req, _server, { json }) => {
				const calendar = getCalendar();
				if (!calendar) {
					return json({
						success: false,
						error: 'Not authenticated',
						redirect: await authenticateURL(),
					});
				}

				try {
					const events = await getEvents(calendar, 7);
					return json({ success: true, events });
				} catch {
					return json({
						success: false,
						error: 'Error getting events',
						redirect: await authenticateURL(),
					});
				}
			},
		},
		true
	);
}

export const initRouting = _initRouting as () => ServeOptions<unknown>;

export type KioskRoutes = ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
