import { createServeOptions, withRequestBody } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import type { Database } from '../../lib/db';
import type { TuyaDB } from './index';
import * as z from 'zod';

const TuyaConfig = z.object({
	apiKey: z.string().min(1, 'API Key is required'),
	apiSecret: z.string().min(1, 'API Secret is required'),
	apiRegion: z.string().min(1, 'API Region is required'),
	virtualDeviceId: z.string().min(1, 'Virtual Device ID is required'),
});

export type TuyaConfig = z.infer<typeof TuyaConfig>;

function _initRouting(db: Database<TuyaDB>) {
	return createServeOptions(
		{
			'/config': {
				GET: (_req, _server, { json }) => {
					const config = db.current();
					const credentials = config.credentials;
					return json({
						apiKey: credentials?.apiKey ?? null,
						hasApiSecret: !!credentials?.apiSecret,
						apiRegion: credentials?.apiRegion ?? null,
						virtualDeviceId: credentials?.virtualDeviceId ?? null,
					});
				},
				POST: withRequestBody(TuyaConfig, (body, _req, _server, { error, json }) => {
					try {
						// Store the config
						db.update((old) => ({
							...old,
							credentials: {
								apiKey: body.apiKey,
								apiSecret: body.apiSecret,
								apiRegion: body.apiRegion,
								virtualDeviceId: body.virtualDeviceId,
							},
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

export const initRouting = _initRouting as (db: Database<TuyaDB>) => ServeOptions<unknown>;

export type TuyaRoutes = ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
