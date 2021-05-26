import chalk from 'chalk';
import { Control, Discovery } from 'magic-home';
import { getEnv } from '../../lib/io';
import { LogObj, logTag } from '../../lib/logger';
import { tryConnectBoard } from './board';
import {
	ArduinoClient,
	arduinoClients,
	HexClient,
	hexClients,
	MagicHomeClient,
	magicHomeClients,
	setClients,
	setHexClients,
	setMagicHomeClients,
} from './clients';

let magicHomeTimer: NodeJS.Timeout | null = null;
let arduinoTimer: NodeJS.Timeout | null = null;
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
	setClients([...magicHomeClients, ...arduinoClients, ...hexClients]);

	return clients.length;
}

export async function scanArduinos(): Promise<number> {
	if (arduinoClients.length === 0) {
		const board = await tryConnectBoard(true);
		if (board) {
			arduinoClients.push(new ArduinoClient(board));
		}
	}

	setClients([...magicHomeClients, ...arduinoClients, ...hexClients]);

	return arduinoClients.length;
}

export function scanHex(): number {
	const ip = getEnv('MODULE_LED_HEX_IP', false);
	if (!ip) {
		return 0;
	}

	setHexClients([new HexClient(ip)]);
	setClients([...magicHomeClients, ...arduinoClients, ...hexClients]);

	return 1;
}

export async function scanRGBControllers(
	first = false,
	logObj: LogObj = undefined
): Promise<number> {
	const [magicHomeClients, arduinoClients, hexClients] = await Promise.all([
		scanMagicHomeControllers(first),
		scanArduinos(),
		scanHex(),
	]);
	const clients = magicHomeClients + arduinoClients + hexClients;

	if (magicHomeClients === 0) {
		if (magicHomeTimer !== null) {
			clearInterval(magicHomeTimer);
		}
		magicHomeTimer = setTimeout(async () => {
			await scanMagicHomeControllers();
			if (magicHomeTimer !== null) {
				clearInterval(magicHomeTimer);
			}
		}, RESCAN_TIME);
	}
	if (arduinoClients === 0) {
		if (arduinoTimer !== null) {
			clearInterval(arduinoTimer);
		}
		arduinoTimer = setTimeout(async () => {
			await scanArduinos();
			if (arduinoTimer !== null) {
				clearInterval(arduinoTimer);
			}
		}, RESCAN_TIME);
	}

	if (!logObj) {
		logTag('rgb', 'cyan', 'Found', chalk.bold(String(clients)), 'clients');
	} else {
		logTag('rgb', 'cyan', 'Found', chalk.bold(String(clients)), 'clients');
	}

	return clients;
}
