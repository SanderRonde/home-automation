import { SettablePromise } from '../../lib/settable-promise';
import { LogObj } from '../../lib/logging/lob-obj';
import { TELEGRAM_IPS } from '../../lib/constants';
import { createRoutes } from '../../lib/routes';
import type { Routes } from '../../lib/routes';
import { MessageHandler } from './message';
import type { ModuleConfig } from '..';
import { getEnv } from '../../lib/io';
import type { BunRequest } from 'bun';
import chalk from 'chalk';
import * as z from 'zod';

function isInIPRange(
	ip: number[],
	range: {
		start: number[];
		lower: number[];
		upper: number[];
	}
) {
	let blockIndex = 0;
	for (let i = 0; i < range.start.length; i++, blockIndex++) {
		if (ip[blockIndex] !== range.start[i]) {
			return false;
		}
	}

	return ip[blockIndex] >= range.lower[0] && ip[blockIndex] <= range.upper[0];
}

function isFromTelegram(req: BunRequest) {
	const fwd = req.headers.get('x-forwarded-for') as string;
	const [ipv4] = fwd.split(',');
	const ipBlocks = ipv4.split('.').map((p) => parseInt(p));
	return TELEGRAM_IPS.some((r) => isInIPRange(ipBlocks, r));
}

export const messageHandlerInstance = new SettablePromise<MessageHandler>();
export async function initRouting({ db }: ModuleConfig): Promise<Routes> {
	const secret = getEnv('SECRET_BOT', true);
	messageHandlerInstance.set(await new MessageHandler(secret, db).init());

	return createRoutes({
		'/msg': async (req) => {
			if (isFromTelegram(req)) {
				const { message, edited_message } = z
					.object({
						message: z.any(),
						edited_message: z.any().optional(),
					})
					.parse(await req.json());
				const logObj = LogObj.fromReqRes(req).attachMessage(
					chalk.bold(chalk.cyan('[bot]'))
				);
				return await (
					await messageHandlerInstance.value
				).handleMessage(message, edited_message, logObj);
			} else {
				return new Response('auth problem', { status: 500 });
			}
		},
	});
}
