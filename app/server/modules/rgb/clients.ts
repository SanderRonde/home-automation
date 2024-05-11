import {
	HEX_LEDS,
	LED_NAME,
	MAGIC_LEDS,
	RING_LEDS,
	WLED_LEDS,
} from '../../config/led-config';

import { MagicHomeClient } from './client/MagicHomeClient';
import { WLEDRGBClient } from './client/WLEDRGBClient';
import { RingClient } from './client/RingClient';
import { RGBClient } from './client/RGBClient';
import { HexClient } from './client/HexClient';

export let magicHomeClients: MagicHomeClient[] = [];
export let ringClients: RingClient[] = [];
export let hexClients: HexClient[] = [];
export let clients: RGBClient[] = [];
export let wledClients: WLEDRGBClient[] = [];

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

export function setClients(
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
