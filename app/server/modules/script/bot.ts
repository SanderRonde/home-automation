import { BotStateBase } from '../../lib/bot-state';
import { MatchParameters } from '../bot/message';
import { MatchResponse } from '../bot/types';
import { ExternalHandler } from './external';

export class Bot extends BotStateBase {
	public static readonly commands = {
		'/runscript': 'Run given script',
		'/killpc': 'Shut down pc',
		'/wakepc': 'Start pc',
		'/help_script': 'Print help comands for script',
	};

	public static readonly botName = 'Script';

	public static readonly matches = Bot.createMatchMaker(
		({ matchMaker: mm }) => {
			mm(
				'/runscript',
				/run script ([^ ]+)/,
				async ({ logObj, match }) => {
					const script = match[1];
					const output = await new ExternalHandler(
						logObj,
						'SCRIPT.BOT'
					).script(script);
					if (output) {
						return `Script output: ${output}`;
					} else {
						return 'Ran script, no output';
					}
				}
			);
			mm('/killpc', /(shutdown|kill) desktop/, async ({ logObj }) => {
				await new ExternalHandler(logObj, 'SCRIPT.BOT').script(
					'shutdown_desktop'
				);
				return 'Shut it down';
			});
			mm('/wakepc', /(wake|start|boot) desktop/, async ({ logObj }) => {
				await new ExternalHandler(logObj, 'SCRIPT.BOT').script(
					'wake_desktop'
				);
				return 'Started it';
			});
			mm('/help_script', /what commands are there for script/, () => {
				return `Commands are:\n${Bot.matches.matches
					.map((match) => {
						return `RegExps: ${match.regexps
							.map((r) => r.source)
							.join(', ')}. Texts: ${match.texts.join(', ')}}`;
					})
					.join('\n')}`;
			});
		}
	);

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
