import { attachMessage, LogObj } from '../../lib/logger';
import { createHookables } from '../../lib/util';
import webhooks from '../../config/webhook';
import { Webhook } from '.';
import chalk from 'chalk';

export async function triggerWebhooks(
	name: string,
	params: Record<string, unknown>,
	logObj: LogObj
): Promise<void> {
	if (!(name in webhooks)) {
		attachMessage(logObj, chalk.red('Webhook not found'));
		return;
	}

	const webhook = webhooks[name];
	await webhook(
		createHookables(await Webhook.modules, 'WEBHOOK', name, logObj),
		params
	);
}
