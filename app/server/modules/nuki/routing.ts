import type { ServeOptions, BrandedRouteHandlerResponse } from '../../lib/routes';
import { createServeOptions, withRequestBody } from '../../lib/routes';
import { NukiAPIClient, NukiAPIError } from './client/api';
import type { Database } from '../../lib/db';
import type { NukiDB } from './types';
import type { BunRequest } from 'bun';
import type { Server } from 'bun';
import * as z from 'zod';

export interface NukiDeviceInfo {
	id: string;
	name: string;
	type: 'smartlock' | 'opener';
}

function maskToken(token: string): string {
	if (token.length <= 8) {
		return '****';
	}
	return token.slice(0, 4) + '…' + token.slice(-4);
}

function initRouting(db: Database<NukiDB>, getDevices: () => NukiDeviceInfo[]) {
	return createServeOptions(
		{
			'/config': {
				GET: (_req: BunRequest, _server: Server, { json }: BrandedRouteHandlerResponse) => {
					const { apiToken } = db.current();
					return json({
						hasToken: Boolean(apiToken),
						tokenMasked: apiToken ? maskToken(apiToken) : undefined,
					});
				},
				POST: withRequestBody(
					z.object({
						apiToken: z.string().min(1, 'API token is required'),
					}),
					async (body, _req, _server, { json, error }) => {
						const api = new NukiAPIClient(body.apiToken);
						try {
							await api.getSmartlocks();
						} catch (err) {
							if (err instanceof NukiAPIError && err.status === 401) {
								return error({ error: 'Invalid or expired API token' }, 401);
							}
							return error(
								{
									error: 'Failed to validate token',
									message: err instanceof Error ? err.message : String(err),
								},
								400
							);
						}
						db.update((d) => ({
							...d,
							apiToken: body.apiToken,
						}));
						return json({ success: true });
					}
				),
			},
			'/devices': {
				GET: (_req: BunRequest, _server: Server, { json }: BrandedRouteHandlerResponse) => {
					return json({ devices: getDevices() });
				},
			},
		},
		true
	);
}

export { initRouting };

export type NukiRoutes = ReturnType<typeof initRouting> extends ServeOptions<infer R> ? R : never;
