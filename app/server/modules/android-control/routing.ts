import { createServeOptions, withRequestBody } from '../../lib/routes';
import type { Device as AndroidDevice } from '@devicefarmer/adbkit';
import type { ServeOptions } from '../../lib/routes';
import { AndroidControlProfile } from './types';
import type { AndroidControlDB } from './types';
import type { Database } from '../../lib/db';
import adb from '@devicefarmer/adbkit';
import * as z from 'zod';

const AndroidControlProfileSchema = z.enum<
	AndroidControlProfile,
	[AndroidControlProfile, ...AndroidControlProfile[]]
>(Object.values(AndroidControlProfile) as [AndroidControlProfile, ...AndroidControlProfile[]]);

const AndroidControlDeviceEntrySchema = z.object({
	profile: AndroidControlProfileSchema,
	deviceId: z.string(),
});

const AndroidControlConfigSchema = z.object({
	androidDevices: z.array(AndroidControlDeviceEntrySchema).optional(),
	adbPath: z.string().optional(),
});

function _initRouting(db: Database<AndroidControlDB>) {
	return createServeOptions(
		{
			'/config': {
				GET: (_req, _server, { json }) => {
					const config = db.current();
					return json({
						profiles: [...Object.values(AndroidControlProfile)],
						androidDevices: config.androidDevices ?? [],
					});
				},
				POST: withRequestBody(
					AndroidControlConfigSchema,
					(body, _req, _server, { error, json }) => {
						try {
							db.update((old) => ({
								...old,
								androidDevices: body.androidDevices ?? [],
							}));
							return json({ success: true });
						} catch {
							return error({ error: 'Invalid config structure' }, 400);
						}
					}
				),
			},
			'/adb-devices': {
				GET: async (_req, _server, { json }) => {
					const adbClient = adb.createClient({});
					const devices = (await adbClient.listDevices()) as AndroidDevice[];
					return json({ devices: devices.map((d) => d.id) });
				},
			},
		},
		true
	);
}

export const initRouting = _initRouting as (
	db: Database<AndroidControlDB>
) => ServeOptions<unknown>;

export type AndroidControlRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
