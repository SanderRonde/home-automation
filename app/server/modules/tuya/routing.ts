import { createServeOptions, withRequestBody } from '../../lib/routes';
import type { ModuleConfig } from '..';
import type { TuyaAPI } from './api';
import type { TuyaDB } from '.';
import * as z from 'zod';

function _initRouting({ db }: ModuleConfig, api: TuyaAPI | null) {
	return createServeOptions(
		{
			'/devices': (_req, _server, { json }) => {
				const devices = (db as typeof db & { current(): TuyaDB }).current()?.devices ?? {};
				return json({ devices });
			},
		'/devices/add': withRequestBody(
			z.object({
				id: z.string(),
				key: z.string(),
				ip: z.string(),
				version: z.string().default('3.3'),
				role: z.enum(['master', 'slave']).optional(),
			}),
			(body, _req, _server, { json }) => {
				const typedDb = db as typeof db & {
					current(): TuyaDB;
					update(fn: (old: TuyaDB) => TuyaDB): void;
				};
				const devices = typedDb.current()?.devices ?? {};
				devices[body.id] = {
					id: body.id,
					key: body.key,
					ip: body.ip,
					version: body.version,
					role: body.role,
				};
				typedDb.update((old) => ({
					...old,
					devices,
				}));
				return json({ success: true });
			}
		),
		'/devices/remove': withRequestBody(
			z.object({
				id: z.string(),
			}),
			(body, _req, _server, { json }) => {
				const typedDb = db as typeof db & {
					current(): TuyaDB;
					update(fn: (old: TuyaDB) => TuyaDB): void;
				};
				const devices = typedDb.current()?.devices ?? {};
				delete devices[body.id];
				typedDb.update((old) => ({
					...old,
					devices,
				}));
				return json({ success: true });
			}
		),
		'/devices/:id/set': withRequestBody(
			z.object({
				dps: z.record(z.unknown()),
			}),
			async (body, req, _server, { json }) => {
				if (!api) {
					return json({ error: 'Tuya API not initialized' }, { status: 500 });
				}
				const success = await api.setDeviceState(req.params.id, body.dps);
				return json({ success });
			}
		),
		},
		false
	);
}

export const initRouting = _initRouting;
