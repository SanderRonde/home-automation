import {
	ringClients,
	clients,
	getLed,
	hexClients,
	magicHomeClients,
} from './clients';
import {
	errorHandle,
	requireParams,
	authAll,
	auth,
} from '../../lib/decorators';
import type { ResponseLike } from '../../lib/logging/response-logger';
import type { LED_NAME } from '../../config/led-config';
import { LogObj } from '../../lib/logging/lob-obj';
import { scanRGBControllers } from './scan';
import { colorList } from "../../lib/color";
import type { Effects } from './ring-api';
import { ringEffects } from './ring-api';
import { Color } from '../../lib/color';
import { CustomMode } from 'magic-home';
import { hexEffects } from './hex-api';
import chalk from 'chalk';

export const HEX_REGEX = /#([a-fA-F\d]{2})([a-fA-F\d]{2})([a-fA-F\d]{2})/;

export type ColorTarget =
	| 'all'
	| 'hex'
	| 'hexes'
	| 'magic'
	| 'magichome'
	| 'magic-home'
	| 'ceiling'
	| 'ceilingled'
	| 'ceiling-led'
	| 'arduino'
	| 'rgb'
	| 'led'
	| 'leds'
	| 'it'
	| 'them'
	| 'color';

export class APIHandler {
	private static _getClientSetFromTarget(target: ColorTarget | LED_NAME) {
		switch (target) {
			case 'hex':
			case 'hexes':
				return hexClients;
			case 'magic':
			case 'magichome':
			case 'magic-home':
				return magicHomeClients;
			case 'ceiling':
			case 'ceilingled':
			case 'ceiling-led':
			case 'arduino':
				return ringClients;
			case 'all':
			case 'rgb':
			case 'led':
			case 'leds':
			case 'it':
			case 'them':
			case 'color':
				return clients;
			default: {
				const specificLed = getLed(target);
				if (specificLed) {
					return [specificLed];
				}
				return clients;
			}
		}
	}

	public static overrideTransition(
		pattern: CustomMode,
		transition: 'fade' | 'jump' | 'strobe'
	): CustomMode {
		return new CustomMode()
			.addColorList(
				pattern.colors.map(({ red, green, blue }) => {
					return [red, green, blue] as [number, number, number];
				})
			)
			.setTransitionType(transition);
	}

	@errorHandle
	@requireParams('color')
	@auth
	public static async setColor(
		res: ResponseLike,
		{
			color,
			intensity,
			target = 'all',
		}: {
			color: string;
			intensity?: number;
			auth?: string;
			target?: ColorTarget | LED_NAME;
		}
	): Promise<boolean> {
		color = color.toLowerCase().trim();
		if (!(color in colorList)) {
			LogObj.fromRes(res).attachMessage(`Unknown color "${color}"`);
			res.status(400).end();
			return false;
		}
		const hexColor = colorList[color as keyof typeof colorList];
		const { r, g, b } = Color.fromHex(hexColor);

		const clientSet = this._getClientSetFromTarget(target);
		LogObj.fromRes(res)
			.attachMessage(`rgb(${r}, ${g}, ${b})`)
			.attachMessage(chalk.bgHex(hexColor)('   '))
			.attachMessage(`Updated ${clientSet.length} clients`);

		if (
			(
				await Promise.all(
					clientSet.map(async (client) => {
						return client.setColorWithBrightness(
							r,
							g,
							b,
							intensity || 100
						);
					})
				)
			).every((v) => v)
		) {
			res.status(200).end();
			return true;
		} else {
			res.status(500).write('Failed to write value');
			res.end();
			return false;
		}
	}

	@errorHandle
	@requireParams('red', 'green', 'blue')
	@authAll
	public static async setRGB(
		res: ResponseLike,
		{
			red,
			green,
			blue,
			intensity,
			target = 'all',
		}: {
			red: string;
			green: string;
			blue: string;
			auth?: string;
			intensity?: number;
			target?: ColorTarget | LED_NAME;
		}
	): Promise<boolean> {
		const redNum = Math.min(255, Math.max(0, parseInt(red, 10)));
		const greenNum = Math.min(255, Math.max(0, parseInt(green, 10)));
		const blueNum = Math.min(255, Math.max(0, parseInt(blue, 10)));
		const clientSet = this._getClientSetFromTarget(target);
		LogObj.fromRes(res)
			.attachMessage(`rgb(${red}, ${green}, ${blue})`)
			.attachMessage(
				chalk.bgHex(new Color(redNum, greenNum, blueNum).toHex())('   ')
			)
			.attachMessage(`Updated ${clientSet.length} clients`);

		if (
			(
				await Promise.all(
					clientSet.map(async (client) => {
						return client.setColorWithBrightness(
							redNum,
							greenNum,
							blueNum,
							intensity || 100
						);
					})
				)
			).every((v) => v)
		) {
			res.status(200).end();
			return true;
		} else {
			res.status(500).write('Failed to write value');
			res.end();
			return false;
		}
	}

	@errorHandle
	@requireParams('power')
	@authAll
	public static async setPower(
		res: ResponseLike,
		{
			power,
			target = 'all',
		}: {
			power: string;
			auth?: string;
			target?: ColorTarget | LED_NAME;
		}
	): Promise<boolean> {
		const clientSet = this._getClientSetFromTarget(target);

		LogObj.fromRes(res)
			.attachMessage(`Turned ${power}`)
			.attachMessage(`Updated ${clientSet.length} clients`);
		if (
			(
				await Promise.all(
					clientSet.map((c) =>
						power === 'on' ? c.turnOn() : c.turnOff()
					)
				)
			).every((v) => v)
		) {
			res.status(200).end();
			return true;
		} else {
			res.status(500).write('Failed to write data');
			res.end();
			return false;
		}
	}

	@errorHandle
	@requireParams('effect')
	@auth
	public static async runEffect(
		res: ResponseLike,
		body: {
			effect: Effects;
			auth?: string;
		} & Record<string, unknown>
	): Promise<boolean> {
		const { effect: effectName } = body;
		if (
			!Object.prototype.hasOwnProperty.call(ringEffects, effectName) &&
			!Object.prototype.hasOwnProperty.call(hexEffects, effectName)
		) {
			LogObj.fromRes(res).attachMessage(
				`Effect ${effectName} does not exist`
			);
			res.status(400).write('Unknown effect');
			res.end();
			return false;
		}

		const isArduinoEffect = !!ringEffects[effectName];
		const effects = {
			...ringEffects,
			...hexEffects,
		};
		const effect = effects[effectName];

		const clients = isArduinoEffect ? ringClients : hexClients;
		try {
			const strings = isArduinoEffect
				? await Promise.all(
						ringClients.map(async (c) => {
							return c.runEffect(
								effect.effect(c.numLeds),
								effectName
							);
						})
					)
				: await Promise.all(
						hexClients.map(async (c) =>
							c.runEffect(
								(
									effect.effect as unknown as {
										name: string;
										params: Record<string, string>;
									}
								).name,
								(
									effect.effect as unknown as {
										name: string;
										params: Record<string, string>;
									}
								).params
							)
						)
					);
			LogObj.fromRes(res)
				.attachMessage(`Running effect ${effectName}`)
				.attachMessage(`Updated ${clients.length} clients`)
				.attachMessage(`Sent string "${String(strings[0])}"`);
			res.status(200).end();
			return true;
		} catch (e) {
			console.log(e);
			LogObj.fromRes(res)
				.attachMessage(`Failed to run effect ${effectName}`)
				.attachMessage(`Updated ${clients.length} clients`);
			res.status(400).write('Failed to run effect');
			res.end();
			return false;
		}
	}

	@errorHandle
	@auth
	public static async refresh(res: ResponseLike): Promise<void> {
		await scanRGBControllers();
		res.status(200);
		res.end();
	}
}
