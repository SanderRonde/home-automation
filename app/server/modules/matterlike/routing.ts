import { createServeOptions, withRequestBody } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import type { Database } from '../../lib/db';
import type { MatterlikeDB } from '.';
import * as z from 'zod';

const MatterlikeConfig = z.object({
	devices: z.array(z.string().url('Invalid URL')),
});

export type MatterlikeConfig = z.infer<typeof MatterlikeConfig>;

function _initRouting(db: Database<MatterlikeDB>) {
	return createServeOptions(
		{
			'/config': {
				GET: (_req, _server, { json }) => {
					const configJson = db.current().devices ?? [];
					return json({ devices: configJson });
				},
				POST: withRequestBody(MatterlikeConfig, (body, _req, _server, { error, json }) => {
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

export const initRouting = _initRouting as (db: Database<MatterlikeDB>) => ServeOptions<unknown>;

export type MatterlikeRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
