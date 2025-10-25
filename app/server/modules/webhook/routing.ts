import { createServeOptions, untypedRequestJson, withRequestBody } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import { LogObj } from '../../lib/logging/lob-obj';
import type { WebhookAPI } from './webhook-api';
import type { ModuleConfig } from '../modules';
import { triggerWebhooks } from './webhooks';
import * as z from 'zod';

function _initRouting(_config: ModuleConfig, api: WebhookAPI) {
	return createServeOptions(
		{
			'/list': {
				GET: (_req, _server, { json }) => {
					const webhooks = api.listWebhooks();
					return json({ webhooks });
				},
			},
			'/create': withRequestBody(
				z.object({
					name: z
						.string()
						.regex(
							/^[a-zA-Z0-9_-]+$/,
							'Name must be alphanumeric with hyphens or underscores'
						),
					description: z.string().optional(),
				}),
				(body, _req, _server, { json, error }) => {
					const success = api.createWebhook(body.name, body.description);
					if (!success) {
						return error('Webhook already exists', 409);
					}
					return json({ success: true });
				}
			),
			'/:name/delete': {
				DELETE: (req, _server, { json, error }) => {
					const name = req.params.name;
					const success = api.deleteWebhook(name);
					if (!success) {
						return error('Webhook not found', 404);
					}
					return json({ success: true });
				},
			},
			'/:name': async (req, _server, { text }) => {
				const name = req.params.name;
				const params = (await untypedRequestJson(req)) as Record<string, unknown>;
				await triggerWebhooks(
					name,
					params,
					LogObj.fromReqRes(req).attachMessage(`Webhook ${name}`),
					api
				);
				return text('OK', 200);
			},
		},
		false
	);
}

export const initRouting = _initRouting as (
	config: ModuleConfig,
	api: WebhookAPI
) => ServeOptions<unknown>;

export type WebhookRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
