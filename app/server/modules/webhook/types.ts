import type { LogObj } from '../../lib/logging/lob-obj';
import type { PossiblePromise } from '../../lib/types';
import type { AllModules } from '..';

export type WebHookConfig = {
	[key: string]: (
		hookables: AllModules,
		logObj: LogObj,
		params: Record<string, unknown>
	) => PossiblePromise<void>;
};

export interface Webhook {
	name: string;
	createdAt: number;
	description?: string;
	lastTriggeredAt?: number;
}

export interface WebhookTrigger {
	id: string;
	timestamp: number;
	method: string;
	body: unknown;
	headers: Record<string, string>;
	ip: string;
}

export interface WebhookDB {
	webhooks?: Record<string, Webhook>;
	triggers?: Record<string, WebhookTrigger[]>;
}
