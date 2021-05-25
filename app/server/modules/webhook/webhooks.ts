import { attachMessage, LogObj } from '../../lib/logger';
import webhooks from '../../config/webhook';
import chalk from 'chalk';
import { createHookables } from '../../lib/util';
import { Webhook } from '.';

export async function triggerWebhooks(
	name: string,
	logObj: LogObj
): Promise<void> {
	if (!(name in webhooks)) {
		attachMessage(logObj, chalk.red('Webhook not found'));
		return;
	}

	const webhook = webhooks[name];
	await webhook(
		createHookables(await Webhook.modules, 'WEBHOOK', name, logObj)
	);
}
