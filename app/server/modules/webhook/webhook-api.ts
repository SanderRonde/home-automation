import type { Webhook, WebhookDB, WebhookTrigger } from './types';
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

		// Also delete triggers for this webhook
		const newTriggers = { ...(this._db.current().triggers ?? {}) };
		delete newTriggers[name];

		this._db.update((old) => ({
			...old,
			webhooks: newWebhooks,
			triggers: newTriggers,
		}));

		return true;
	}

	public webhookExists(name: string): boolean {
		const webhooks = this._db.current().webhooks ?? {};
		return !!webhooks[name];
	}

	public recordTrigger(name: string, trigger: Omit<WebhookTrigger, 'id'>): void {
		const triggers = this._db.current().triggers ?? {};
		const webhookTriggers = triggers[name] ?? [];

		const newTrigger: WebhookTrigger = {
			...trigger,
			id: `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
		};

		this._db.update((old) => ({
			...old,
			webhooks: {
				...(old.webhooks ?? {}),
				[name]: {
					...(old.webhooks?.[name] ?? {
						name,
						createdAt: Date.now(),
					}),
					lastTriggeredAt: trigger.timestamp,
				},
			},
			triggers: {
				...(old.triggers ?? {}),
				[name]: [...webhookTriggers, newTrigger],
			},
		}));
	}

	public getTriggers(name: string, limit = 100): WebhookTrigger[] {
		const triggers = this._db.current().triggers ?? {};
		const webhookTriggers = triggers[name] ?? [];

		// Return last N triggers in reverse chronological order
		return webhookTriggers.slice(-limit).reverse();
	}

	public getLastTrigger(name: string): number | undefined {
		const webhook = this.getWebhook(name);
		return webhook?.lastTriggeredAt;
	}
}
