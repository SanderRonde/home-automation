import { BotState } from '../../lib/bot-state';
import { Color } from '../../lib/color';
import { colorList } from '../../lib/data';
import { attachMessage, logTag } from '../../lib/logger';
import { arrToObj } from '../../lib/util';
import { MatchParameters } from '../bot/message';
import { MatchResponse } from '../bot/types';
import { ColorTarget, HEX_REGEX } from './api';
import { arduinoEffects, Effects } from './arduino-api';
import { arduinoClients, getLed, magicHomeClients } from './clients';
import { ExternalHandler } from './external';
import { getLedFromName } from './helpers';
import { hexEffects } from './hex-api';
import { scanArduinos, scanRGBControllers } from './scan';
import { ArduinoConfig, DIR, JoinedConfigs } from './types';
import { exec } from 'child_process';

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

export class Bot extends BotState.Base {
	static readonly commands = {
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
			[...Object.keys(arduinoEffects), ...Object.keys(hexEffects)].map(
				(key) => {
					const value =
						arduinoEffects[key as Effects] ||
						hexEffects[key as keyof typeof hexEffects];
					return [`/effect${key}`, `Effect. ${value.description}`];
				}
			)
		),
	};

	static readonly botName = 'RGB';

	static colorTextToColor(text: string): Color | null {
		if (HEX_REGEX.test(text)) {
			return Color.fromHex(text);
		}
		if (text in colorList) {
			return Color.fromHex(colorList[text as keyof typeof colorList]);
		}
		return null;
	}

	static parseDir(dir: string): DIR {
		if (dir === 'backwards' || dir === 'back' || dir === '0') {
			return DIR.DIR_BACKWARDS;
		}
		return DIR.DIR_FORWARDS;
	}

	static readonly matches = Bot.createMatchMaker(({ matchMaker: mm }) => {
		mm('/rgbon', async ({ logObj, matchText }) => {
			if (
				await new ExternalHandler(logObj, `BOT.${matchText}`).power(
					'on'
				)
			) {
				return 'Turned it on';
			} else {
				return 'Failed to turn it on';
			}
		});
		mm('/rgboff', async ({ logObj, matchText }) => {
			if (
				await new ExternalHandler(logObj, `BOT.${matchText}`).power(
					'off'
				)
			) {
				return 'Turned it off';
			} else {
				return 'Failed tot turn it on';
			}
		});
		mm(/turn (on|off) (rgb|led)/, async ({ logObj, match, matchText }) => {
			const targetState = match[1];
			if (
				await new ExternalHandler(logObj, `BOT.${matchText}`).power(
					targetState as 'on' | 'off'
				)
			) {
				return `Turned it ${targetState}`;
			} else {
				return `Failed to turn it ${targetState}`;
			}
		});
		mm(/turn (on|off) (desk|couch|wall|bed)/, async ({ logObj, match }) => {
			const targetState = match[1];
			const ledName = getLedFromName(match[2])!;
			const client = getLed(ledName);
			if (!client) {
				return 'Failed to find client';
			}

			if (targetState === 'on') {
				attachMessage(logObj, 'Turned it on');
				await client.turnOn();
				return 'Turned it on';
			} else {
				attachMessage(logObj, 'Turned it off');
				await client.turnOff();
				return 'Turned it off';
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
							arduinoClients.map((c) =>
								targetState === 'on' ? c.turnOn() : c.turnOff()
							)
						)
					).every((v) => v)
				) {
					attachMessage(
						logObj,
						`Turned ${targetState} ${arduinoClients.length} arduino clients`
					);
					return `Turned ${targetState} ${arduinoClients.length} arduino clients`;
				} else {
					return `Failed to turn ${targetState} ${arduinoClients.length} arduino clients`;
				}
			}
		);
		mm(
			'/magicoff',
			/turn (on|off) (magic(-| )home)/,
			async ({ logObj, match }) => {
				const targetState = match.length === 0 ? 'off' : match[1];

				if (
					(
						await Promise.all(
							magicHomeClients.map((c) =>
								targetState === 'on' ? c.turnOff() : c.turnOff()
							)
						)
					).every((v) => v)
				) {
					attachMessage(
						logObj,
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
			async ({ logObj, match, matchText }) => {
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
					(await new ExternalHandler(logObj, `BOT.${matchText}`).rgb(
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
			async ({ logObj, match, matchText }) => {
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
					(await new ExternalHandler(logObj, `BOT.${matchText}`).rgb(
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
		mm(/\/effect((\w{2,})|[^s])/, async ({ logObj, match, matchText }) => {
			const effectName = match[1] as Effects;
			if (
				!(effectName in arduinoEffects) &&
				!(effectName in hexEffects)
			) {
				return `Effect "${effectName}" does not exist`;
			}

			if (
				await new ExternalHandler(logObj, `BOT.${matchText}`).effect(
					effectName,
					{}
				)
			) {
				return `Started effect "${effectName}" with config ${JSON.stringify(
					arduinoEffects[effectName] ||
						hexEffects[effectName as keyof typeof hexEffects]
				)}`;
			} else {
				return 'Failed to start effect';
			}
		});
		mm(
			'/effects',
			/what effects are there(\?)?/,
			async ({ logObj, match, matchText }) => {
				if (match?.[1]) {
					const effectName = `s${match[1]}` as Effects;
					if (
						!(effectName in arduinoEffects) &&
						!(effectName in hexEffects)
					) {
						return `Effect "${effectName}" does not exist`;
					}

					if (
						await new ExternalHandler(
							logObj,
							`BOT.${matchText}`
						).effect(effectName, {})
					) {
						return `Started effect "${effectName}" with config ${JSON.stringify(
							arduinoEffects[effectName] ||
								hexEffects[
									effectName as keyof typeof hexEffects
								]
						)}`;
					} else {
						return 'Failed to start effect';
					}
				}

				return `Effects are:\n${[
					...Object.keys(arduinoEffects),
					...Object.keys(hexEffects),
				]
					.map((key) => {
						const value =
							arduinoEffects[key as Effects] ||
							hexEffects[key as keyof typeof hexEffects];
						return `/effect${key} - ${value.description}`;
					})
					.join('\n')}`;
			}
		);
		mm('/refresh', /refresh (rgb|led)/, async ({ logObj }) => {
			return `Found ${await scanRGBControllers(
				false,
				logObj
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
		mm('/reconnect', /reconnect( to arduino)?/, async () => {
			logTag('self', 'red', 'Reconnecting to arduino');
			const amount = await scanArduinos();
			return `Found ${amount} arduino clients`;
		});
		mm('/restart', /restart( yourself)?/, /reboot( yourself)?/, () => {
			logTag('self', 'red', 'Restarting self');
			setTimeout(async () => {
				await restartSelf();
			}, 50);
			return 'Restarting...';
		});
		mm(
			/\/marked ([^ ]+)/,
			async ({ logObj, match, ask, sendText, askCancelable }) => {
				const file = match[1];
				const { message, success } = await new ExternalHandler(
					logObj,
					'BOT.marked'
				).markedAudio(file, {
					ask,
					sendText,
					askCancelable,
				});

				if (success) {
					return message || 'Playing!';
				}
				return message!;
			}
		);
	});

	constructor(_json?: Record<string, never>) {
		super();
	}

	public lastConfig:
		| (ArduinoConfig & {
				data?: JoinedConfigs;
		  })
		| null = null;

	static async match(
		config: MatchParameters
	): Promise<MatchResponse | undefined> {
		return await this.matchLines({
			...config,
			matchConfig: Bot.matches,
		});
	}

	toJSON(): Record<string, never> {
		return {};
	}
}
