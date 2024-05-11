import { TELEGRAM_IPS } from '../../lib/constants';
import { SettablePromise } from '../../lib/util';
import { createRouter } from '../../lib/api';
import { MessageHandler } from './message';
import { getEnv } from '../../lib/io';
import { TelegramReq } from './types';
import { ModuleConfig } from '..';
import { Bot } from '.';

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

function isFromTelegram(req: TelegramReq) {
	const fwd = req.headers['x-forwarded-for'] as string;
	const [ipv4] = fwd.split(',');
	const ipBlocks = ipv4.split('.').map((p) => parseInt(p));
	return TELEGRAM_IPS.some((r) => isInIPRange(ipBlocks, r));
}

export const messageHandlerInstance = new SettablePromise<MessageHandler>();
export async function initRouting({ app, db }: ModuleConfig<typeof Bot>): Promise<void> {
	const secret = getEnv('SECRET_BOT', true);
	messageHandlerInstance.set(await new MessageHandler(secret, db).init());

	const router = createRouter(Bot, {});
	router.all('/msg', async (req, res) => {
		if (isFromTelegram(req)) {
			await (await messageHandlerInstance.value).handleMessage(req, res);
		} else {
			res.write('Error: auth problem');
			res.end();
		}
	});
	router.use(app);
}
