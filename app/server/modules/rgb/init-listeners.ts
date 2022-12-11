import {
	initRGBListeners,
	LED_KEYVAL_MAP,
	LED_NAME,
} from '../../config/led-config';
import { LogObj, attachSourcedMessage } from '../../lib/logger';
import { getLed } from './clients';
import chalk from 'chalk';
import { RGB } from '.';

async function switchLed(name: LED_NAME, value: string, logObj: LogObj) {
	const client = getLed(name);
	if (!client) {
		return;
	}
	if (value === '1') {
		attachSourcedMessage(
			logObj,
			'keyval listener',
			await RGB.explainHook,
			'Setting',
			chalk.bold(client.address),
			'to on'
		);
		(await RGB.explainHook)(
			`Set rgb ${name} to white`,
			'keyval listener',
			logObj
		);
		if (client.setWhiteForPower) {
			return client.setColor(255, 255, 255);
		}
		return client.turnOn();
	} else if (value === '0') {
		attachSourcedMessage(
			logObj,
			'keyval listener',
			await RGB.explainHook,
			'Turned off',
			chalk.bold(client.address)
		);
		return client.turnOff();
	}
	return Promise.resolve();
}

export function initListeners(): void {
	void (async () => {
		const external = new (await RGB.modules).keyval.External(
			{},
			'RGB.INIT'
		);

		await initRGBListeners();
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
