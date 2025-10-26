import type { LogObj } from '../../lib/logging/lob-obj';
import type { WebhookAPI } from './webhook-api';
import webhooks from '../../config/webhook';
import { Webhook } from '.';
import chalk from 'chalk';

export async function triggerWebhooks(
	name: string,
	params: Record<string, unknown>,
	logObj: LogObj,
	api: WebhookAPI
): Promise<void> {
	// Check if webhook exists in database
	const webhookExists = api.webhookExists(name);

	// Also check config file for backwards compatibility
	const configWebhookExists = name in webhooks;

	if (!webhookExists && !configWebhookExists) {
		logObj.attachMessage(chalk.red('Webhook not found'));
		return;
	}

	// If webhook exists in database, trigger associated scenes
	if (webhookExists) {
		const modules = await Webhook.modules;
		const { SceneTriggerType } = await import('../../../../types/scene.js');
		const deviceAPI = await modules.device.api.value;
		await deviceAPI.sceneAPI.onTrigger({
			type: SceneTriggerType.WEBHOOK,
			webhookName: name,
		});
	}

	// If config webhook exists, execute it (for backwards compatibility)
	if (configWebhookExists) {
		const webhook = webhooks[name];
		await webhook(await Webhook.modules, logObj.attachMessage('Webhook'), params);
	}
}
