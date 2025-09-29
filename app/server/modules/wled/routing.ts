import { createServeOptions } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import type { Database } from '../../lib/db';
import { auth } from '../../lib/auth';
import type { WLEDDB } from '.';
import * as z from 'zod';

const WLEDConfig = z.object({
	devices: z.array(
		z
			.string()
			.regex(
				/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
				'Invalid IP address'
			)
	),
});

export type WLEDConfig = z.infer<typeof WLEDConfig>;

function _initRouting(db: Database<WLEDDB>) {
	return createServeOptions({
		'/config': {
			GET: (req, _server, { error, json }) => {
				if (!auth(req)) {
					return error('Unauthorized', 401);
				}
				const configJson = db.current().devices ?? [];
				return json({ devices: configJson });
			},
			POST: async (req, _server, { error, json }) => {
				if (!auth(req)) {
					return error('Unauthorized', 401);
				}

				try {
					const config = WLEDConfig.parse(await req.json());

					// Store the config
					db.update((old) => ({ ...old, devices: config.devices }));

					return json({ success: true });
				} catch (e) {
					return error({ error: 'Invalid config structure' }, 400);
				}
			},
		},
	});
}

export const initRouting = _initRouting as (
	db: Database<WLEDDB>
) => ServeOptions<unknown>;

export type WledRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
