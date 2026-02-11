import { createServeOptions, withRequestBody, untypedRequestJson } from '../../lib/routes';
import type { SmartAppContext, WebHookResponse } from '@smartthings/smartapp';
import type { SmartThingsDB, createContextStore, createSmartApp } from '.';
import type { SmartThingsDeviceData } from './client/cluster';
import type { ServeOptions } from '../../lib/routes';
import type { Database } from '../../lib/db';
import type { ModuleConfig } from '..';
import * as z from 'zod';

function _initRouting(
	_config: ModuleConfig,
	db: Database<SmartThingsDB>,
	contextStore: ReturnType<typeof createContextStore>,
	createSmartAppFn: typeof createSmartApp,
	updateDevices: (devices: SmartThingsDeviceData[], ctx: SmartAppContext) => Promise<void>
) {
	return createServeOptions(
		{
			'/webhook': {
				POST: async (req, _server, { json, error, text }) => {
					const smartapp = createSmartAppFn(db, contextStore, updateDevices);
					if (!smartapp) {
						return error(
							{
								error: 'SmartThings not configured',
								message: 'Set Client ID and Client Secret in config',
							},
							503
						);
					}

					let body: unknown = null;
					try {
						body = await untypedRequestJson(req);
					} catch {
						return error('Invalid JSON body', 400);
					}

					// SDK signature verification expects path (and query), not full URL.
					// Express req.url is path; Bun Request.url is full URL — normalize to path.
					const requestUrl = new URL(req.url);
					const pathAndQuery = requestUrl.pathname + (requestUrl.search || '');
					const headers: Record<string, string> = {};
					for (const [k, v] of req.headers.entries()) {
						headers[k] = v;
					}
					const adaptedReq = {
						body,
						url: pathAndQuery,
						originalUrl: pathAndQuery,
						headers,
						method: req.method,
					};

					let out: Awaited<ReturnType<typeof json>> = json({}, { status: 200 });
					const adaptedRes: WebHookResponse & { statusCode: number } = {
						statusCode: 200,
						status(c: number) {
							this.statusCode = c;
							return adaptedRes;
						},
						json(data: unknown) {
							out = json(data as object, { status: this.statusCode });
							return adaptedRes;
						},
						send(payload: string | object) {
							if (typeof payload === 'string') {
								out = text(payload, this.statusCode);
							} else {
								out = json(payload as object, { status: this.statusCode });
							}
							return adaptedRes;
						},
					};

					await smartapp.handleHttpCallback(adaptedReq, adaptedRes);
					return out;
				},
			},
			'/config': {
				GET: (_req, _server, { json }) => {
					const { clientId, clientSecret } = db.current();
					return json({
						clientId: clientId ?? '',
						hasClientSecret: Boolean(clientSecret),
						webhookPath: '/smartthings/webhook',
					});
				},
				POST: withRequestBody(
					z.object({
						clientId: z.string(),
						clientSecret: z.string().optional(),
					}),
					async (body, _req, _server, { json }) => {
						db.update((d) => ({
							...d,
							clientId: body.clientId,
							...(body.clientSecret !== undefined && {
								clientSecret: body.clientSecret,
							}),
						}));
						return json({ success: true });
					}
				),
			},
		},
		{ '/smartthings/webhook': false }
	);
}

export const initRouting = _initRouting as (
	config: ModuleConfig,
	db: Database<SmartThingsDB>,
	contextStore: ReturnType<typeof createContextStore>,
	createSmartAppFn: typeof createSmartApp
) => ServeOptions<unknown>;

export type SmartThingsRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
