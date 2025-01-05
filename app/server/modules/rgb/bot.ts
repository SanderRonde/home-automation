import { ringClients, getLed, magicHomeClients } from './clients';
import type { ArduinoConfig, JoinedConfigs } from './types';
import { getLedFromName } from '../../config/led-config';
import { arrToObj, asyncTimeout } from '../../lib/util';
import type { MatchParameters } from '../bot/message';
import { BotStateBase } from '../../lib/bot-state';
import { logTag } from '../../lib/logging/logger';
import type { MatchResponse } from '../bot/types';
import { ExternalHandler } from './external';
import { scanRGBControllers } from './scan';
import { colorList } from '../../lib/data';
import type { Effects } from './ring-api';
import { ringEffects } from './ring-api';
import type { ColorTarget } from './api';
import { Color } from '../../lib/color';
import { hexEffects } from './hex-api';
import { exec } from 'child_process';
import { HEX_REGEX } from './api';
import { DIR } from './types';

function restartSelf() {
	return new Promise<void>((resolve) => {
		// Restart this program
		exec(
			'sudo -u root su -c "zsh -c \\"source /root/.zshrc ; forever restart automation\\""',
			(err, _stdout, stderr) => {
				if (err) {
					console.log('Failed to restart :(', stderr);
					resolve();
					return;
				}
				resolve();
			}
		);
	});
}

export class Bot extends BotStateBase {
	public static readonly commands = {
		'/rgboff': 'Turn off RGB',
		'/rgbon': 'Turn on RGB',
		'/arduinooff': 'Turn off arduino lights',
		'/magicoff': 'Turn off magic-home lights',
		'/color': 'Set color to given value',
		'/pattern': 'Start given pattern',
		'/effect': 'Start given effect',
		'/intensity': 'Set intensity to given value',
		'/blocksize': 'Set block size to given value',
		'/red': 'Set red to given value',
		'/green': 'Set green to given value',
		'/blue': 'Set blue to given value',
		'/background': 'Set background to given color',
		'/dot': 'Set dot to given color',
		'/updatetime': 'Set update-time to given value',
		'/dir': 'Set dir to given value',
		'/mode': 'Set mode to given value',
		'/effects': 'List effects',
		'/refresh': 'Refresh LEDs',
		'/help_rgb': 'Print help comands for RGB',
		'/reconnect': 'Reconnect to arduino board',
		'/restart': 'Restart the server',
		'/marked': 'Play marked audio file',
		...arrToObj(
			[...Object.keys(ringEffects), ...Object.keys(hexEffects)].map(
				(key) => {
					const value =
						ringEffects[key as Effects] ||
						hexEffects[key as keyof typeof hexEffects];
					return [`/effect${key}`, `Effect. ${value.description}`];
				}
			)
		),
	};

	public static readonly botName = 'RGB';

	public static readonly matches = Bot.createMatchMaker(
		({ matchMaker: mm }) => {
			mm('/rgbon', async ({ logObj }) => {
				if (await new ExternalHandler(logObj).power('on')) {
					return 'Turned it on';
				} else {
					return 'Failed to turn it on';
				}
			});
			mm('/rgboff', async ({ logObj }) => {
				if (await new ExternalHandler(logObj).power('off')) {
					return 'Turned it off';
				} else {
					return 'Failed tot turn it on';
				}
			});
			mm(/turn (on|off) (rgb|led)/, async ({ logObj, match }) => {
				const targetState = match[1];
				if (
					await new ExternalHandler(logObj).power(
						targetState as 'on' | 'off'
					)
				) {
					return `Turned it ${targetState}`;
				} else {
					return `Failed to turn it ${targetState}`;
				}
			});
			mm(
				'/arduinooff',
				/turn (on|off) (ceiling|arduino|duino)/,
				async ({ logObj, match }) => {
					const targetState = match.length === 0 ? 'off' : match[1];
					if (
						(
							await Promise.all(
								ringClients.map((c) =>
									targetState === 'on'
										? c.turnOn()
										: c.turnOff()
								)
							)
						).every((v) => v)
					) {
						logObj.attachMessage(
							`Turned ${targetState} ${ringClients.length} arduino clients`
						);
						return `Turned ${targetState} ${ringClients.length} arduino clients`;
					} else {
						return `Failed to turn ${targetState} ${ringClients.length} arduino clients`;
					}
				}
			);
			mm(/turn (on|off) (\w+)/, async ({ logObj, match }) => {
				const targetState = match[1];
				const ledName = getLedFromName(match[2])!;
				const client = getLed(ledName);
				if (!client) {
					return 'Failed to find client';
				}

				if (targetState === 'on') {
					logObj.attachMessage('Turned it on');
					await client.turnOn();
					return 'Turned it on';
				} else {
					logObj.attachMessage('Turned it off');
					await client.turnOff();
					return 'Turned it off';
				}
			});
			mm(
				'/magicoff',
				/turn (on|off) (magic(-| )home)/,
				async ({ logObj, match }) => {
					const targetState = match.length === 0 ? 'off' : match[1];

					if (
						(
							await Promise.all(
								magicHomeClients.map((c) =>
									targetState === 'on'
										? c.turnOff()
										: c.turnOff()
								)
							)
						).every((v) => v)
					) {
						logObj.attachMessage(
							`Turned ${targetState} ${magicHomeClients.length} magichome clients`
						);
						return `Turned ${targetState} ${magicHomeClients.length} magichome clients`;
					} else {
						return `Failed to turn ${targetState} ${magicHomeClients.length} magichome clients`;
					}
				}
			);
			mm(
				/set (rgb|led(?:s)?|it|them|color|hexes|hex|ceiling|ceilingled|arduino|magic|magichome) to (?:(?:(\d+) (\d+) (\d+))|([^ ]+))(\s+with intensity (\d+))?/,
				async ({ logObj, match }) => {
					const target = match[1] as ColorTarget;
					const colorR = match[2];
					const colorG = match[3];
					const colorB = match[4];
					const colorStr = match[5];
					const intensity = match[7];
					const resolvedColor = (() => {
						if (colorStr) {
							return Bot.colorTextToColor(colorStr);
						}
						if (colorR && colorG && colorB) {
							return new Color(
								parseInt(colorR, 10),
								parseInt(colorG, 10),
								parseInt(colorB, 10)
							);
						}
						return undefined;
					})();
					if (
						resolvedColor &&
						(await new ExternalHandler(logObj).rgb(
							String(resolvedColor.r),
							String(resolvedColor.g),
							String(resolvedColor.b),
							intensity?.length ? parseInt(intensity, 10) : 0,
							target
						))
					) {
						return `Set color to ${JSON.stringify(resolvedColor)}`;
					} else {
						return 'Failed to set color (invalid color or bad connection to board)';
					}
				}
			);
			mm(
				/\/color (?:(?:(\d+) (\d+) (\d+))|([^ ]+))/,
				async ({ logObj, match }) => {
					const colorR = match[1];
					const colorG = match[2];
					const colorB = match[3];
					const colorStr = match[4];
					const intensity = match[6];
					const resolvedColor = (() => {
						if (colorStr) {
							return Bot.colorTextToColor(colorStr);
						}
						if (colorR && colorG && colorB) {
							return new Color(
								parseInt(colorR, 10),
								parseInt(colorG, 10),
								parseInt(colorB, 10)
							);
						}
						return undefined;
					})();
					if (
						resolvedColor &&
						(await new ExternalHandler(logObj).rgb(
							String(resolvedColor.r),
							String(resolvedColor.g),
							String(resolvedColor.b),
							intensity?.length ? parseInt(intensity, 10) : 0
						))
					) {
						return `Set color to ${JSON.stringify(resolvedColor)}`;
					} else {
						return 'Failed to set color (invalid color or bad connection to board)';
					}
				}
			);
			mm(/\/effect((\w{2,})|[^s])/, async ({ logObj, match }) => {
				const effectName = match[1] as Effects;
				if (
					!(effectName in ringEffects) &&
					!(effectName in hexEffects)
				) {
					return `Effect "${effectName}" does not exist`;
				}

				if (await new ExternalHandler(logObj).effect(effectName, {})) {
					return `Started effect "${effectName}" with config ${JSON.stringify(
						ringEffects[effectName] ||
							hexEffects[effectName as keyof typeof hexEffects]
					)}`;
				} else {
					return 'Failed to start effect';
				}
			});
			mm(
				'/effects',
				/what effects are there(\?)?/,
				async ({ logObj, match }) => {
					if (match?.[1]) {
						const effectName = `s${match[1]}` as Effects;
						if (
							!(effectName in ringEffects) &&
							!(effectName in hexEffects)
						) {
							return `Effect "${effectName}" does not exist`;
						}

						if (
							await new ExternalHandler(logObj).effect(
								effectName,
								{}
							)
						) {
							return `Started effect "${effectName}" with config ${JSON.stringify(
								ringEffects[effectName] ||
									hexEffects[
										effectName as keyof typeof hexEffects
									]
							)}`;
						} else {
							return 'Failed to start effect';
						}
					}

					return `Effects are:\n${[
						...Object.keys(ringEffects),
						...Object.keys(hexEffects),
					]
						.map((key) => {
							const value =
								ringEffects[key as Effects] ||
								hexEffects[key as keyof typeof hexEffects];
							return `/effect${key} - ${value.description}`;
						})
						.join('\n')}`;
				}
			);
			mm('/refresh', /refresh (rgb|led)/, async () => {
				return `Found ${await scanRGBControllers(
					false
				)} RGB controllers`;
			});
			mm('/help_rgb', /what commands are there for rgb/, () => {
				return `Commands are:\n${Bot.matches.matches
					.map((match) => {
						return `RegExps: ${match.regexps
							.map((r) => r.source)
							.join(', ')}. Texts: ${match.texts.join(', ')}}`;
					})
					.join('\n')}`;
			});
			mm('/restart', /restart( yourself)?/, /reboot( yourself)?/, () => {
				logTag('self', 'red', 'Restarting self');
				asyncTimeout(async () => {
					await restartSelf();
				}, 50);
				return 'Restarting...';
			});
			mm(
				/\/marked ([^ ]+)/,
				async ({ logObj, match, ask, sendText, askCancelable }) => {
					const file = match[1];
					const { message, success } = await new ExternalHandler(
						logObj
					).markedAudio(file, {
						ask,
						sendText,
						askCancelable,
					});

					if (success) {
						return message || 'Playing!';
					}
					return message;
				}
			);
		}
	);

	public lastConfig:
		| (ArduinoConfig & {
				data?: JoinedConfigs;
		  })
		| null = null;

	public static colorTextToColor(text: string): Color | null {
		if (HEX_REGEX.test(text)) {
			return Color.fromHex(text);
		}
		if (text in colorList) {
			return Color.fromHex(colorList[text as keyof typeof colorList]);
		}
		return null;
	}

	public static parseDir(dir: string): DIR {
		if (dir === 'backwards' || dir === 'back' || dir === '0') {
			return DIR.DIR_BACKWARDS;
		}
		return DIR.DIR_FORWARDS;
	}

	public static async match(
		config: MatchParameters
	): Promise<MatchResponse | undefined> {
		return await this.matchLines({
			...config,
			matchConfig: Bot.matches,
		});
	}

	public toJSON(): Record<string, never> {
		return {};
	}
}
