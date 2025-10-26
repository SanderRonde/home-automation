import { createServeOptions, withRequestBody } from '../../lib/routes';
import { SceneTriggerType } from '../../../../types/scene';
import type { ServeOptions } from '../../lib/routes';
import { logTag } from '../../lib/logging/logger';
import type { WebhookAPI } from './webhook-api';
import type { ModuleConfig } from '../modules';
import * as z from 'zod';

function _initRouting(config: ModuleConfig, api: WebhookAPI) {
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
			'/:name/triggers': {
				GET: (req, _server, { json, error }) => {
					const name = req.params.name;
					if (!api.webhookExists(name)) {
						return error('Webhook not found', 404);
					}
					const triggers = api.getTriggers(name);
					return json({ triggers });
				},
			},
			'/:name': async (req, _server, { text, error }) => {
				const name = req.params.name;
				// Check if webhook exists in database
				const webhookExists = api.webhookExists(name);

				if (!webhookExists) {
					logTag('webhook', 'red', `Webhook ${name} not found`);
					return error('Webhook not found', 404);
				}

				// Record trigger details
				const filteredHeaders: Record<string, string> = {};
				const sensitiveHeaders = [
					'authorization',
					'cookie',
					'set-cookie',
					'x-api-key',
					'x-auth-token',
				];

				for (const [key, value] of Object.entries(req.headers)) {
					if (
						!sensitiveHeaders.includes(key.toLowerCase()) &&
						typeof value === 'string'
					) {
						filteredHeaders[key] = value;
					}
				}

				let body: unknown;
				try {
					const rawBody = await req.text();
					body = rawBody ? JSON.parse(rawBody) : {};
				} catch {
					body = {};
				}

				const ip =
					filteredHeaders['x-forwarded-for'] || filteredHeaders['x-real-ip'] || 'unknown';

				api.recordTrigger(name, {
					timestamp: Date.now(),
					method: req.method,
					body,
					headers: filteredHeaders,
					ip,
				});

				// If webhook exists in database, trigger associated scenes
				const deviceAPI = await config.modules.device.api.value;
				logTag('webhook', 'blue', `Triggering webhook ${name}`);
				await deviceAPI.sceneAPI.onTrigger({
					type: SceneTriggerType.WEBHOOK,
					webhookName: name,
				});
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
