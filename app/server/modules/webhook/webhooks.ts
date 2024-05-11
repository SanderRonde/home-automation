import { attachMessage, LogObj } from '@server/lib/logger';
import { createHookables } from '@server/lib/util';
import webhooks from '@server/config/webhook';
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
