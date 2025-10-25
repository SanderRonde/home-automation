import type { Webhook, WebhookDB } from './types';
import type { Database } from '../../lib/db';

export class WebhookAPI {
	public constructor(private readonly _db: Database<WebhookDB>) {}

	public listWebhooks(): Webhook[] {
		const webhooks = this._db.current().webhooks ?? {};
		return Object.values(webhooks);
	}

	public getWebhook(name: string): Webhook | undefined {
		const webhooks = this._db.current().webhooks ?? {};
		return webhooks[name];
	}

	public createWebhook(name: string, description?: string): boolean {
		const webhooks = this._db.current().webhooks ?? {};
		if (webhooks[name]) {
			return false; // Webhook already exists
		}

		const newWebhook: Webhook = {
			name,
			createdAt: Date.now(),
			description,
		};

		this._db.update((old) => ({
			...old,
			webhooks: {
				...(old.webhooks ?? {}),
				[name]: newWebhook,
			},
		}));

		return true;
	}

	public deleteWebhook(name: string): boolean {
		const webhooks = this._db.current().webhooks ?? {};
		if (!webhooks[name]) {
			return false;
		}

		const newWebhooks = { ...webhooks };
		delete newWebhooks[name];

		this._db.update((old) => ({
			...old,
			webhooks: newWebhooks,
		}));

		return true;
	}

	public webhookExists(name: string): boolean {
		const webhooks = this._db.current().webhooks ?? {};
		return !!webhooks[name];
	}
}
