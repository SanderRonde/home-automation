import { createServeOptions, withRequestBody } from '../../lib/routes';
import type { PushNotificationManager } from './push-manager';
import type { ServeOptions } from '../../lib/routes';
import * as z from 'zod';

function _initRouting(pushManager: PushNotificationManager) {
	return createServeOptions(
		{
			'/vapid-public-key': (_req, _server, { json }) => {
				return json({ publicKey: pushManager.getVapidPublicKey() });
			},
			'/subscriptions': (_req, _server, { json }) => {
				return json({ subscriptions: pushManager.listSubscriptions() });
			},
			'/register': withRequestBody(
				z.object({
					endpoint: z.string(),
					keys: z.object({
						p256dh: z.string(),
						auth: z.string(),
					}),
					userAgent: z.string().optional(),
					name: z.string().optional(),
				}),
				(body, _req, _server, { json, error }) => {
					try {
						const subscription = pushManager.addSubscription(body);
						return json({ success: true, subscription });
					} catch (e) {
						return error(
							e instanceof Error ? e.message : 'Failed to register subscription',
							400
						);
					}
				}
			),
			'/:id/unregister': (req, _server, { json }) => {
				const success = pushManager.removeSubscription(req.params.id);
				if (!success) {
					return json({ error: 'Subscription not found' }, { status: 404 });
				}
				return json({ success: true });
			},
			'/:id/toggle': withRequestBody(
				z.object({
					enabled: z.boolean(),
				}),
				(body, req, _server, { json }) => {
					const success = pushManager.updateSubscriptionEnabled(
						req.params.id,
						body.enabled
					);
					if (!success) {
						return json({ error: 'Subscription not found' }, { status: 404 });
					}
					return json({ success: true });
				}
			),
			'/:id/update-name': withRequestBody(
				z.object({
					name: z.string(),
				}),
				(body, req, _server, { json }) => {
					const success = pushManager.updateSubscriptionName(req.params.id, body.name);
					if (!success) {
						return json({ error: 'Subscription not found' }, { status: 404 });
					}
					return json({ success: true });
				}
			),
			'/settings': {
				GET: (_req, _server, { json }) => {
					return json({ settings: pushManager.getSettings() });
				},
				POST: withRequestBody(z.record(z.boolean()), (body, _req, _server, { json }) => {
					pushManager.updateSettings(body);
					return json({ success: true, settings: pushManager.getSettings() });
				}),
			},
			'/:id/test': async (req, _server, { json }) => {
				const success = await pushManager.sendTestNotification(req.params.id);
				if (!success) {
					return json({ error: 'Failed to send test notification' }, { status: 400 });
				}
				return json({ success: true });
			},
		},
		true
	);
}

export const initRouting = _initRouting as (
	pushManager: PushNotificationManager
) => ServeOptions<unknown>;

export type NotificationRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
