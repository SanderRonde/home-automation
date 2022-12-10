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
import { LED_NAMES } from '../../lib/constants';
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
	const clients: HexClient[] = [];
	const bedIp = getEnv('MODULE_LED_BED_HEX_IP', false);
	if (bedIp) {
		clients.push(new HexClient(bedIp, LED_NAMES.BED_HEX_LEDS));
	}
	const deskIp = getEnv('MODULE_LED_DESK_HEX_IP', false);
	if (deskIp) {
		clients.push(new HexClient(deskIp, LED_NAMES.DESK_HEX_LEDS));
	}

	setHexClients(clients);
	return clients.length;
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
