import {
	RingClient,
	HexClient,
	MagicHomeClient,
	setHexClients,
	setMagicHomeClients,
	setRingClients,
} from './clients';
import { LogObj, logTag } from '../../lib/logger';
import { Control, Discovery } from 'magic-home';
import { getEnv } from '../../lib/io';
import chalk from 'chalk';

let magicHomeTimer: NodeJS.Timeout | null = null;
const RESCAN_TIME = 1000 * 60;

export async function scanMagicHomeControllers(first = false): Promise<number> {
	const scanTime =
		first && process.argv.indexOf('--debug') > -1 ? 250 : 10000;
	const clients = (await new Discovery().scan(scanTime))
		.map((client) => ({
			control: new Control(client.address, {
				wait_for_reply: false,
			}),
			address: client.address,
		}))
		.map((client) => new MagicHomeClient(client.control, client.address));

	setMagicHomeClients(clients);

	return clients.length;
}

export function scanRing(): number {
	const ip = getEnv('MODULE_LED_RING_IP', false);
	if (!ip) {
		return 0;
	}

	setRingClients([new RingClient(ip)]);

	return 1;
}

export function scanHex(): number {
	const ip = getEnv('MODULE_LED_HEX_IP', false);
	if (!ip) {
		return 0;
	}

	setHexClients([new HexClient(ip)]);

	return 1;
}

export async function scanRGBControllers(
	first = false,
	logObj: LogObj = undefined
): Promise<number> {
	const [magicHomeClients, ringClients, hexClients] = await Promise.all([
		scanMagicHomeControllers(first),
		scanRing(),
		scanHex(),
	]);
	const clients = magicHomeClients + ringClients + hexClients;

	if (magicHomeClients === 0) {
		if (magicHomeTimer !== null) {
			clearInterval(magicHomeTimer);
		}
		magicHomeTimer = setTimeout(() => {
			void scanMagicHomeControllers().then(() => {
				if (magicHomeTimer !== null) {
					clearInterval(magicHomeTimer);
				}
			});
		}, RESCAN_TIME);
	}

	if (!logObj) {
		logTag('rgb', 'cyan', 'Found', chalk.bold(String(clients)), 'clients');
	} else {
		logTag('rgb', 'cyan', 'Found', chalk.bold(String(clients)), 'clients');
	}

	return clients;
}
