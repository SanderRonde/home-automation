import {
	HEX_LEDS,
	MAGIC_LEDS,
	RING_LEDS,
	WLED_LEDS,
} from '../../config/led-config';
import type { LED_NAME } from '../../config/led-config';

import type { MagicHomeClient } from './client/MagicHomeClient';
import type { WLEDRGBClient } from './client/WLEDRGBClient';
import type { RingClient } from './client/RingClient';
import type { RGBClient } from './client/RGBClient';
import type { HexClient } from './client/HexClient';

export let magicHomeClients: MagicHomeClient[] = [];
export let ringClients: RingClient[] = [];
export let hexClients: HexClient[] = [];
export let clients: RGBClient[] = [];
let wledClients: WLEDRGBClient[] = [];

export function getLed(name: LED_NAME): RGBClient | null {
	const joinedNames = {
		...MAGIC_LEDS,
		...HEX_LEDS,
		...WLED_LEDS,
		...Object.fromEntries(
			Object.entries(RING_LEDS).map(([k, v]) => [v[0], k])
		),
	};

	if (Object.values(joinedNames).includes(name)) {
		return clients.find((client) => client.id === name) ?? null;
	}
	return null;
}

function setClients(
	newClients: (MagicHomeClient | RingClient | HexClient | WLEDRGBClient)[] = [
		...magicHomeClients,
		...ringClients,
		...hexClients,
		...wledClients,
	]
): void {
	clients = newClients;
}

export function setMagicHomeClients(newClients: MagicHomeClient[]): void {
	magicHomeClients = newClients;
	setClients();
}

export function setHexClients(newClients: HexClient[]): void {
	hexClients = newClients;
	setClients();
}

export function setWLEDClients(newClients: WLEDRGBClient[]): void {
	wledClients = newClients;
	setClients();
}

export function setRingClients(newClients: RingClient[]): void {
	ringClients = newClients;
	setClients();
}
