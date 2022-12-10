import {
	LED_NAMES,
	NIGHTSTAND_COLOR,
	WAKELIGHT_TIME,
} from '../../lib/constants';
import { LogObj, attachSourcedMessage, attachMessage } from '../../lib/logger';
import { asyncSetInterval } from '../../lib/util';
import { getLed } from './clients';
import chalk from 'chalk';
import { RGB } from '.';

async function switchLed(name: LED_NAMES, value: string, logObj: LogObj) {
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

let wakelights: NodeJS.Timeout[] = [];
function cancelActiveWakelights() {
	wakelights.forEach((timer) => clearInterval(timer));
	wakelights = [];
}

export function initListeners(): void {
	void (async () => {
		const external = new (await RGB.modules).keyval.External(
			{},
			'RGB.INIT'
		);
		await external.onChange(
			'room.lights.nightstand',
			async (value, _key, logObj) => {
				cancelActiveWakelights();

				const client = getLed(LED_NAMES.BED_LEDS);
				if (!client) {
					return;
				}
				if (value === '1') {
					attachMessage(
						attachSourcedMessage(
							logObj,
							'keyval listener',
							await RGB.explainHook,
							'Setting',
							chalk.bold(client.address),
							`to color rgb(${NIGHTSTAND_COLOR.r}, ${NIGHTSTAND_COLOR.g}, ${NIGHTSTAND_COLOR.b})`
						),
						chalk.bgHex(NIGHTSTAND_COLOR.toHex())('   ')
					);
					await client.setColor(
						NIGHTSTAND_COLOR.r,
						NIGHTSTAND_COLOR.g,
						NIGHTSTAND_COLOR.b
					);
				} else if (value === '0') {
					attachSourcedMessage(
						logObj,
						'keyval listener',
						await RGB.explainHook,
						'Turned off',
						chalk.bold(client.address)
					);
					await client.turnOff();
				}
				return Promise.resolve();
			}
		);

		await external.onChange(
			'room.leds.wakelight',
			async (value, _key, logObj) => {
				cancelActiveWakelights();

				const client = getLed(LED_NAMES.BED_LEDS);
				if (!client) {
					return;
				}
				if (value === '1') {
					attachMessage(
						attachSourcedMessage(
							logObj,
							'keyval listener',
							await RGB.explainHook,
							'Fading in',
							chalk.bold(client.address),
							`to color rgb(${NIGHTSTAND_COLOR.r}, ${NIGHTSTAND_COLOR.g}, ${NIGHTSTAND_COLOR.b})`
						),
						chalk.bgHex(NIGHTSTAND_COLOR.toHex())('   ')
					);

					let count = 2;
					const interval = asyncSetInterval(async () => {
						await client.setColorWithBrightness(
							NIGHTSTAND_COLOR.r,
							NIGHTSTAND_COLOR.g,
							NIGHTSTAND_COLOR.b,
							count
						);

						if (count++ === 100) {
							clearInterval(interval);
							wakelights.splice(wakelights.indexOf(interval), 1);
						}
					}, WAKELIGHT_TIME / 100);
					wakelights.push(interval);
					await client.setColorWithBrightness(
						NIGHTSTAND_COLOR.r,
						NIGHTSTAND_COLOR.g,
						NIGHTSTAND_COLOR.b,
						count
					);
				} else if (value === '0') {
					cancelActiveWakelights();
					attachSourcedMessage(
						logObj,
						'keyval listener',
						await RGB.explainHook,
						'Turned off',
						chalk.bold(client.address)
					);
					await client.turnOff();
				}
				return Promise.resolve();
			}
		);
		await Promise.all(
			Object.entries({
				'room.leds.ring': LED_NAMES.RING_LEDS,
				'room.leds.bed': LED_NAMES.BED_LEDS,
				'room.leds.desk': LED_NAMES.DESK_LEDS,
				'room.leds.wall': LED_NAMES.WALL_LEDS,
				'room.leds.couch': LED_NAMES.COUCH_LEDS,
				'room.leds.hexBed': LED_NAMES.BED_HEX_LEDS,
				'room.leds.hexDesk': LED_NAMES.DESK_HEX_LEDS,
			}).map(async ([key, ledName]) => {
				await external.onChange(key, async (value, _key, logObj) => {
					await switchLed(ledName, value, logObj);
				});
			})
		);
	})();
}
