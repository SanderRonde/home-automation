import { LogObj } from '../../lib/logging/lob-obj';
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
		logObj.attachMessage(chalk.red('Webhook not found'));
		return;
	}

	const webhook = webhooks[name];
	await webhook(
		createHookables(await Webhook.modules, 'WEBHOOK', name, logObj),
		params
	);
}
