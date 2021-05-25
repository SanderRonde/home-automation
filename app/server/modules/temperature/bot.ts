import { BotState } from '../../lib/bot-state';
import { attachMessage } from '../../lib/logger';
import { MatchParameters } from '../bot/message';
import { MatchResponse } from '../bot/types';
import { ExternalHandler } from './external';
import { getAll } from './temp-controller';
import { Mode } from './types';

export class Bot extends BotState.Base {
	static readonly commands = {
		'/temp': 'Get the current temperature',
		'/heat': 'Start heating',
		'/heatoff': 'Stop heating',
		'/heatauto': 'Set heat mode to auto',
		'/help_temperature': 'Print help commands for temperature',
	};

	static readonly botName = 'Temperature';

	static readonly matches = Bot.createMatchMaker(({ matchMaker: mm }) => {
		mm(
			'/temp',
			/what (is|are) the(current )?temp(erature)?(s)?/,
			/what temp(erature)? is it(\?)?/,
			/how (warm|cold) is it(\?)?/,
			({ logObj }) => {
				attachMessage(
					logObj,
					`Reporting temperatures ${getAll()
						.map((controller) => {
							return Math.round(controller.getLastTemp());
						})
						.join(', ')}`
				);
				const contents = [];
				for (const controller of getAll()) {
					contents.push(
						...[
							['Name', controller.name],
							[
								'Temp',
								String(
									Math.round(controller.getLastTemp() * 10) /
										10
								),
							],
							['Heater state', controller.getHeaterState()],
							['Heater mode', controller.getMode()],
							[
								'Target temperature',
								String(controller.getTarget()),
							],
							['', ''],
						]
					);
				}

				return Bot.makeTable({
					contents: contents,
				});
			}
		);
		mm(
			/\/heatoff (\w+)/,
			/stop heating (\w+)/,
			/make (\w+) cold/,
			async ({ logObj, match }) => {
				const tempName = match[1];
				await new ExternalHandler(
					attachMessage(logObj, 'Stopping heating'),
					'TEMPERATURE.BOT'
				).setMode(tempName, 'off');
				return 'Stopping heating';
			}
		);
		mm(/\/heatauto (\w+)/, async ({ logObj, match }) => {
			const tempName = match[1];
			await new ExternalHandler(
				attachMessage(logObj, 'Set heat mode to auto'),
				'TEMPERATURE.BOT'
			).setMode(tempName, 'auto');
			return 'Set heat mode to auto';
		});
		mm(
			/\/heat (\w+)/,
			/start heating (\w+)/,
			/make (\w+) hot/,
			/heat (\w+)/,
			async ({ logObj, match }) => {
				const tempName = match[1];
				await new ExternalHandler(
					attachMessage(logObj, 'Heating'),
					'TEMPERATURE.BOT'
				).setMode(tempName, 'on');
				return 'Heating';
			}
		);
		mm(
			/\/move (\w+) (left|right) for (\d+)ms/,
			async ({ logObj, match }) => {
				const tempName = match[1];
				await new ExternalHandler(
					attachMessage(logObj, 'Moving'),
					'TEMPERATURE.BOT'
				).moveDir(
					tempName,
					match[2] as 'left' | 'right',
					parseInt(match[3], 10)
				);
				return 'Moving temporarily';
			}
		);
		mm(
			/set(?: temp(?:erature)?) mode to (\w+) for (\w+)/,
			async ({ logObj, match }) => {
				const mode = match[1];
				const tempName = match[2];
				if (['on', 'off', 'auto'].indexOf(mode) === -1) {
					return 'Invalid mode';
				}
				await new ExternalHandler(
					attachMessage(logObj, `Setting mode to ${mode}`),
					'TEMPERATURE.BOT'
				).setMode(tempName, mode as Mode);
				return `Set mode to ${mode}`;
			}
		);
		mm(
			/set(?: temp(?:erature)?) target to ((\d+)(\.\d+)?) for (\w+)/,
			async ({ logObj, match }) => {
				const target = parseFloat(match[1]);
				const tempName = match[2];
				if (Number.isNaN(target) || target === 0 || target < 0) {
					return 'Invalid target';
				}
				await new ExternalHandler(
					attachMessage(logObj, `Setting temp to ${target}`),
					'TEMPERATURE.BOT'
				).setTarget(tempName, target);
				return `Set target to ${target}`;
			}
		);

		mm(
			'/help_temperature',
			/what commands are there for temperature/,
			() => {
				return `Commands are:\n${Bot.matches.matches
					.map((match) => {
						return `RegExps: ${match.regexps
							.map((r) => r.source)
							.join(', ')}. Texts: ${match.texts.join(', ')}}`;
					})
					.join('\n')}`;
			}
		);
	});

	constructor(_json?: JsonWebKey) {
		super();
	}

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
