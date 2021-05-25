import { BotState } from '../../lib/bot-state';
import { attachMessage } from '../../lib/logger';
import { _Bot } from '../bot';
import { ExternalHandler } from './external';

export class Bot extends BotState.Base {
	static readonly commands = {};

	static readonly botName = 'RemoteControl';

	static readonly matches = Bot.createMatchMaker(({ matchMaker: mm }) => {
		mm(/play( (music|netflix|youtube|vlc|movie))?/, async ({ logObj }) => {
			await new ExternalHandler(
				attachMessage(logObj, 'Playing'),
				'REMOTE_CONTROL.BOT'
			).play();
			return 'Playing';
		});
		mm(/pause( (music|netflix|youtube|vlc|movie))?/, async ({ logObj }) => {
			await new ExternalHandler(
				attachMessage(logObj, 'Pausing'),
				'REMOTE_CONTROL.BOT'
			).play();
			return 'Pausing';
		});
		mm(
			/playpause( (music|netflix|youtube|vlc|movie))?/,
			async ({ logObj }) => {
				await new ExternalHandler(
					attachMessage(logObj, 'Playpausing'),
					'REMOTE_CONTROL.BOT'
				).play();
				return 'Playpausing';
			}
		);
		mm(/close( (music|netflix|youtube|vlc|movie))?/, async ({ logObj }) => {
			await new ExternalHandler(
				attachMessage(logObj, 'Closing'),
				'REMOTE_CONTROL.BOT'
			).play();
			return 'Closing';
		});

		mm(/(?:increase|up) volume( by (\d+))?/, async ({ logObj, match }) => {
			await new ExternalHandler(
				attachMessage(logObj, 'Increasing Volume'),
				'REMOTE_CONTROL.BOT'
			).volumeUp(match[1] ? parseInt(match[1], 10) : undefined);
			return 'Increasing Volume';
		});
		mm(
			/(?:decrease|reduce|down) volume( by (\d+))?/,
			async ({ logObj, match }) => {
				await new ExternalHandler(
					attachMessage(logObj, 'Decreasing Volume'),
					'REMOTE_CONTROL.BOT'
				).volumeUp(match[1] ? parseInt(match[1], 10) : undefined);
				return 'Decreasing Volume';
			}
		);

		mm(/set volume to (\d+)/, async ({ logObj, match }) => {
			await new ExternalHandler(
				attachMessage(logObj, 'Setting Volume'),
				'REMOTE_CONTROL.BOT'
			).setVolume(parseInt(match[1], 10));
			return 'Setting Volume';
		});

		mm(
			'/help_remote_control',
			/what commands are there for remote-control/,
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
