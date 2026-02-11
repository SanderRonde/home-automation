import { createServeOptions, withRequestBody } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import type { Database } from '../../lib/db';
import type { LEDArtDB } from '.';
import * as z from 'zod';

const LEDArtConfig = z.object({
	devices: z.array(z.string().url('Invalid URL')),
});

export type LEDArtConfig = z.infer<typeof LEDArtConfig>;

function _initRouting(db: Database<LEDArtDB>) {
	return createServeOptions(
		{
			'/config': {
				GET: (_req, _server, { json }) => {
					const configJson = db.current().devices ?? [];
					return json({ devices: configJson });
				},
				POST: withRequestBody(LEDArtConfig, (body, _req, _server, { error, json }) => {
					try {
						// Store the config
						db.update((old) => ({
							...old,
							devices: body.devices,
						}));

						return json({ success: true });
					} catch {
						return error({ error: 'Invalid config structure' }, 400);
					}
				}),
			},
		},
		true
	);
}

export const initRouting = _initRouting as (db: Database<LEDArtDB>) => ServeOptions<unknown>;

export type LedArtRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
