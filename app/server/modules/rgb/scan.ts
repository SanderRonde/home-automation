import {
	RingClient,
	HexClient,
	MagicHomeClient,
	setHexClients,
	setMagicHomeClients,
	setRingClients,
} from './clients';
import { HEX_LEDS, RING_LEDS } from '../../config/led-config';
import { LogObj, logTag } from '../../lib/logger';
import { Control, Discovery } from 'magic-home';
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
	const clients = Object.entries(RING_LEDS).map(
		([ip, name]) => new RingClient(ip, name[0], name[1].numLeds)
	);
	setRingClients(clients);
	return clients.length;
}

export function scanHex(): number {
	const clients = Object.entries(HEX_LEDS).map(
		([ip, name]) => new HexClient(ip, name)
	);
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
