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

export function initRouting(db: Database<WLEDDB>): ServeOptions {
	return createServeOptions({
		'/config': {
			GET: (req) => {
				if (!auth(req)) {
					return new Response('Unauthorized', { status: 401 });
				}
				const configJson = db.current().devices ?? [];
				return Response.json({ devices: configJson });
			},
			POST: async (req) => {
				if (!auth(req)) {
					return new Response('Unauthorized', { status: 401 });
				}

				try {
					const config = WLEDConfig.parse(await req.json());

					// Store the config
					db.update((old) => ({ ...old, devices: config.devices }));

					return Response.json({ success: true });
				} catch (error) {
					return Response.json(
						{ error: 'Invalid config structure' },
						{ status: 400 }
					);
				}
			},
		},
	});
}
