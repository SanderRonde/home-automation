import { createServeOptions, withRequestBody } from '../../lib/routes';
import type { Database } from '../../lib/db';
import type { BambuLabDB } from './types';
import * as z from 'zod';

const configSchema = z.object({
	ip: z.string().min(1),
	serial: z.string().min(1),
	accessCode: z.string().min(1),
	enabled: z.boolean().optional(),
});

export const initRouting = (db: Database<BambuLabDB>) => {
	return createServeOptions({
		'/config': {
			// Get current configuration (masked)
			GET: async (req, server, { json }) => {
				const data = db.current();
				const config = data?.config;

				if (!config) {
					return json({
						hasConfig: false,
					});
				}

				return json({
					hasConfig: true,
					ip: config.ip,
					serial: config.serial,
					// Mask access code for security
					accessCodeMasked: `${config.accessCode.substring(0, 4)}••••`,
					enabled: config.enabled ?? true,
				});
			},
		},

		'/config-save': withRequestBody(configSchema, async (body, req, server, { json }) => {
			await db.setVal('config', {
				ip: body.ip,
				serial: body.serial,
				accessCode: body.accessCode,
				enabled: body.enabled ?? true,
			});

			return json({ success: true });
		}),

		'/status': {
			// Get current printer status
			GET: async (req, server, { json }) => {
				const data = db.current();
				return json({
					status: data?.lastStatus ?? null,
					connected: data?.config?.enabled ?? false,
				});
			},
		},
	});
};

export type BambuLabRoutes = ReturnType<typeof initRouting>;
