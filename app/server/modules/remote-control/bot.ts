import type { MatchParameters } from '../bot/message';
import { BotStateBase } from '../../lib/bot-state';
import type { MatchResponse } from '../bot/types';
import { ExternalHandler } from './external';

export class Bot extends BotStateBase {
	public static readonly commands = {};

	public static readonly botName = 'RemoteControl';

	public static readonly matches = Bot.createMatchMaker(
		({ matchMaker: mm }) => {
			mm(
				/play( (music|netflix|youtube|vlc|movie))?/,
				async ({ logObj }) => {
					await new ExternalHandler(
						logObj.attachMessage('Playing')
					).play();
					return 'Playing';
				}
			);
			mm(
				/pause( (music|netflix|youtube|vlc|movie))?/,
				async ({ logObj }) => {
					await new ExternalHandler(
						logObj.attachMessage('Pausing')
					).play();
					return 'Pausing';
				}
			);
			mm(
				/playpause( (music|netflix|youtube|vlc|movie))?/,
				async ({ logObj }) => {
					await new ExternalHandler(
						logObj.attachMessage('Playpausing')
					).play();
					return 'Playpausing';
				}
			);
			mm(
				/close( (music|netflix|youtube|vlc|movie))?/,
				async ({ logObj }) => {
					await new ExternalHandler(
						logObj.attachMessage('Closing')
					).play();
					return 'Closing';
				}
			);

			mm(
				/(?:increase|up) volume( by (\d+))?/,
				async ({ logObj, match }) => {
					await new ExternalHandler(
						logObj.attachMessage('Increasing Volume')
					).volumeUp(match[1] ? parseInt(match[1], 10) : undefined);
					return 'Increasing Volume';
				}
			);
			mm(
				/(?:decrease|reduce|down) volume( by (\d+))?/,
				async ({ logObj, match }) => {
					await new ExternalHandler(
						logObj.attachMessage('Decreasing Volume')
					).volumeUp(match[1] ? parseInt(match[1], 10) : undefined);
					return 'Decreasing Volume';
				}
			);

			mm(/set volume to (\d+)/, async ({ logObj, match }) => {
				await new ExternalHandler(
					logObj.attachMessage('Setting Volume')
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
								.join(', ')}. Texts: ${match.texts.join(
								', '
							)}}`;
						})
						.join('\n')}`;
				}
			);
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
