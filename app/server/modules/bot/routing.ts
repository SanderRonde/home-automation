import {
	createServeOptions,
	staticResponse,
	withRequestBody,
} from '../../lib/routes';
import { SettablePromise } from '../../lib/settable-promise';
import type { ServeOptions } from '../../lib/routes';
import { LogObj } from '../../lib/logging/lob-obj';
import { TELEGRAM_IPS } from '../../lib/constants';
import { MessageHandler } from './message';
import type { ModuleConfig } from '..';
import { getEnv } from '../../lib/io';
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

function isFromTelegram(headers: Headers) {
	const fwd = headers.get('x-forwarded-for') as string;
	const [ipv4] = fwd.split(',');
	const ipBlocks = ipv4.split('.').map((p) => parseInt(p));
	return TELEGRAM_IPS.some((r) => isInIPRange(ipBlocks, r));
}

const messageHandlerInstance = new SettablePromise<MessageHandler>();

function _initRouting({ db }: ModuleConfig) {
	const secret = getEnv('SECRET_BOT', true);
	messageHandlerInstance.set(new MessageHandler(secret, db));

	return createServeOptions(
		{
			'/msg': withRequestBody(
				z.object({
					message: z.any(),
					edited_message: z.any().optional(),
				}),
				async (body, req, _server, { json }) => {
					if (isFromTelegram(req.headers)) {
						const { message, edited_message } = body;
						const logObj = LogObj.fromReqRes(req).attachMessage(
							chalk.bold(chalk.cyan('[bot]'))
						);
						return staticResponse(
							await (
								await messageHandlerInstance.value
							).handleMessage(message, edited_message, logObj)
						);
					} else {
						return json('auth problem', { status: 500 });
					}
				}
			),
		},
		false
	);
}

export const initRouting = _initRouting as (
	config: ModuleConfig
) => ServeOptions<unknown>;

export type BotRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
