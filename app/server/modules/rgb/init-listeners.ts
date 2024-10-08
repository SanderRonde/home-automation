import { initRGBListeners, LED_KEYVAL_MAP } from '../../config/led-config';
import type { LED_NAME } from '../../config/led-config';
import { LogObj } from '../../lib/logging/lob-obj';
import { getLed } from './clients';
import chalk from 'chalk';
import { RGB } from '.';

async function switchLed(name: LED_NAME, value: string, logObj: LogObj) {
	const client = getLed(name);
	if (!client) {
		return;
	}
	if (value === '1') {
		logObj.attachMessage('Setting', chalk.bold(client.address), 'to on');
		if (client.setWhiteForPower) {
			return client.setColor(255, 255, 255);
		}
		return client.turnOn();
	} else if (value === '0') {
		logObj.attachMessage('Turned off', chalk.bold(client.address));
		return client.turnOff();
	}
	return Promise.resolve();
}

export function initListeners(): void {
	void (async () => {
		const external = new (await RGB.modules).keyval.External(
			LogObj.fromEvent('RGB.INIT')
		);

		await initRGBListeners(await RGB.modules);
		await Promise.all(
			Object.entries(LED_KEYVAL_MAP).map(async ([ledName, keyvals]) => {
				return Promise.all(
					keyvals.map(async (keyval) => {
						await external.onChange(
							keyval,
							async (value, _key, logObj) => {
								await switchLed(
									ledName as LED_NAME,
									value,
									logObj
								);
							}
						);
					})
				);
			})
		);
	})();
}
