import { createServeOptions, withRequestBody } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import type { Database } from '../../lib/db';
import type { HexLEDDB } from './hex-led';
import * as z from 'zod';

const HexLEDConfig = z.object({
	devices: z.array(z.string().url('Invalid URL')),
});

export type HexLEDConfig = z.infer<typeof HexLEDConfig>;

function _initRouting(db: Database<HexLEDDB>) {
	return createServeOptions(
		{
			'/config': {
				GET: (_req, _server, { json }) => {
					const configJson = db.current().devices ?? [];
					return json({ devices: configJson });
				},
				POST: withRequestBody(HexLEDConfig, (body, _req, _server, { error, json }) => {
					try {
						// Store the config
						db.update((old) => ({
							...old,
							devices: body.devices,
						}));

						return json({ success: true });
					} catch (e) {
						return error({ error: 'Invalid config structure' }, 400);
					}
				}),
			},
		},
		true
	);
}

export const initRouting = _initRouting as (db: Database<HexLEDDB>) => ServeOptions<unknown>;

export type HexLedRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
