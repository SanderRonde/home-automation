import { BotState } from '../../lib/bot-state';
import { _Bot } from '../bot';
import { ExternalHandler } from './external';

export class Bot extends BotState.Base {
	static readonly commands = {
		'/runscript': 'Run given script',
		'/killpc': 'Shut down pc',
		'/wakepc': 'Start pc',
		'/help_script': 'Print help comands for script',
	};

	static readonly botName = 'Script';

	static readonly matches = Bot.createMatchMaker(({ matchMaker: mm }) => {
		mm('/runscript', /run script ([^ ]+)/, async ({ logObj, match }) => {
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
		});
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
	});

	constructor(_json?: Record<string, never>) {
		super();
	}

	static async match(
		config: _Bot.Message.MatchParameters
	): Promise<_Bot.Message.MatchResponse | undefined> {
		return await this.matchLines({
			...config,
			matchConfig: Bot.matches,
		});
	}

	toJSON(): Record<string, never> {
		return {};
	}
}
