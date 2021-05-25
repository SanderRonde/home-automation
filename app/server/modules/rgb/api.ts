import chalk from 'chalk';
import { CustomMode } from 'magic-home';
import { RGB } from '.';
import { Color } from '../../lib/color';
import { colorList } from '../../lib/data';
import {
	errorHandle,
	requireParams,
	authAll,
	auth,
} from '../../lib/decorators';
import {
	ResponseLike,
	attachMessage,
	attachSourcedMessage,
} from '../../lib/logger';
import { arduinoEffects, Effects } from './arduino-api';
import {
	arduinoClients,
	clients,
	hexClients,
	magicHomeClients,
} from './clients';
import { hexEffects } from './hex-api';
import { scanRGBControllers } from './scan';

export const HEX_REGEX = /#([a-fA-F\d]{2})([a-fA-F\d]{2})([a-fA-F\d]{2})/;

export class APIHandler {
	private static _getClientSetFromTarget(target: string) {
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
				return arduinoClients;
			case 'all':
			case 'rgb':
			case 'led':
			case 'leds':
			case 'it':
			case 'them':
			case 'color':
			default:
				return clients;
		}
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
			target?: string;
		},
		source: string
	): Promise<boolean> {
		color = color.toLowerCase().trim();
		if (!(color in colorList)) {
			attachMessage(res, `Unknown color "${color}"`);
			res.status(400).end();
			return false;
		}
		const hexColor = colorList[color as keyof typeof colorList];
		const { r, g, b } = Color.fromHex(hexColor);

		const clientSet = this._getClientSetFromTarget(target);
		attachMessage(
			attachMessage(
				attachSourcedMessage(
					res,
					source,
					await RGB.explainHook,
					`rgb(${r}, ${g}, ${b})`
				),
				chalk.bgHex(hexColor)('   ')
			),
			`Updated ${clientSet.length} clients`
		);

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
			target?: string;
		},
		source: string
	): Promise<boolean> {
		const redNum = Math.min(255, Math.max(0, parseInt(red, 10)));
		const greenNum = Math.min(255, Math.max(0, parseInt(green, 10)));
		const blueNum = Math.min(255, Math.max(0, parseInt(blue, 10)));
		const clientSet = this._getClientSetFromTarget(target);
		attachMessage(
			attachMessage(
				attachSourcedMessage(
					res,
					source,
					await RGB.explainHook,
					`rgb(${red}, ${green}, ${blue})`
				),
				chalk.bgHex(new Color(redNum, greenNum, blueNum).toHex())('   ')
			),
			`Updated ${clientSet.length} clients`
		);

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
		}: {
			power: string;
			auth?: string;
		},
		source: string
	): Promise<boolean> {
		attachMessage(
			attachSourcedMessage(
				res,
				source,
				await RGB.explainHook,
				`Turned ${power}`
			),
			`Updated ${clients.length} clients`
		);
		if (
			(
				await Promise.all(
					clients.map((c) =>
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

	static overrideTransition(
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
	@requireParams('effect')
	@auth
	public static async runEffect(
		res: ResponseLike,
		body: {
			effect: Effects;
			auth?: string;
		} & Record<string, unknown>,
		source: string
	): Promise<boolean> {
		const { effect: effectName } = body;
		if (
			!Object.prototype.hasOwnProperty.call(arduinoEffects, effectName) &&
			!Object.prototype.hasOwnProperty.call(hexEffects, effectName)
		) {
			attachMessage(res, `Effect ${effectName} does not exist`);
			res.status(400).write('Unknown effect');
			res.end();
			return false;
		}

		const isArduinoEffect = !!arduinoEffects[effectName];
		const effects = {
			...arduinoEffects,
			...hexEffects,
		};
		const effect = effects[effectName];

		try {
			const strings = isArduinoEffect
				? await Promise.all(
						arduinoClients.map(async (c) => {
							return c.board.runEffect(effect.effect, effectName);
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
			attachMessage(
				attachMessage(
					attachSourcedMessage(
						res,
						source,
						await RGB.explainHook,
						`Running effect ${effectName}`
					),
					`Updated ${arduinoClients.length} clients`
				),
				`Sent string "${String(strings[0])}"`
			);
			res.status(200).end();
			return true;
		} catch (e) {
			console.log(e);
			attachMessage(
				attachMessage(res, `Failed to run effect ${effectName}`),
				`Updated ${arduinoClients.length} clients`
			);
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
