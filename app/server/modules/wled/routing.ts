import { createServeOptions, untypedRequestJson } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import type { Database } from '../../lib/db';
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
	return createServeOptions(
		{
			'/config': {
				GET: (_req, _server, { json }) => {
					const configJson = db.current().devices ?? [];
					return json({ devices: configJson });
				},
				POST: async (req, _server, { error, json }) => {
					try {
						const config = WLEDConfig.parse(
							await untypedRequestJson(req)
						);

						// Store the config
						db.update((old) => ({
							...old,
							devices: config.devices,
						}));

						return json({ success: true });
					} catch (e) {
						return error(
							{ error: 'Invalid config structure' },
							400
						);
					}
				},
			},
		},
		true
	);
}

export const initRouting = _initRouting as (
	db: Database<WLEDDB>
) => ServeOptions<unknown>;

export type WledRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
