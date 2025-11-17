import { createServeOptions, withRequestBody } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import type { Database } from '../../lib/db';
import type { HomeWizardDB } from './index';
import * as z from 'zod';

const HomeWizardConfig = z.object({
	ip: z.string().ip('Invalid IP address'),
	token: z.string().min(1, 'Token is required'),
});

export type HomeWizardConfig = z.infer<typeof HomeWizardConfig>;

function _initRouting(db: Database<HomeWizardDB>) {
	return createServeOptions(
		{
			'/config': {
				GET: (_req, _server, { json }) => {
					const config = db.current();
					return json({
						ip: config.ip ?? null,
						hasToken: !!config.token,
					});
				},
				POST: withRequestBody(HomeWizardConfig, (body, _req, _server, { error, json }) => {
					try {
						// Store the config
						db.update((old) => ({
							...old,
							...(body.ip !== undefined && { ip: body.ip }),
							...(body.token !== undefined && { token: body.token }),
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

export const initRouting = _initRouting as (db: Database<HomeWizardDB>) => ServeOptions<unknown>;

export type HomeWizardRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
