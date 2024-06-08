import type { MatchParameters } from '../bot/message';
import { disable, enable } from './spotify/checking';
import { BotStateBase } from '../../lib/bot-state';
import type { MatchResponse } from '../bot/types';
import { getSpotifyAPI } from './spotify/api';
import { getURL } from './spotify/auth';

export class Bot extends BotStateBase {
	public static readonly commands = {
		'/auth': 'Authenticate spotify (if needed)',
	};

	public static readonly botName = 'Spotify';

	public static readonly matches = Bot.createMatchMaker(
		({ matchMaker: mm, fallbackSetter: fallback }) => {
			mm('/auth', /auth(enticate)?( spotify)?/, async () => {
				const api = getSpotifyAPI();
				console.log('checking spotify authentiction');
				if (await api.testAuth()) {
					return 'Authenticated!';
				}
				return `Please authenticate with URL ${getURL()}`;
			});
			mm('/enable_beats', async () => {
				await enable();
				return 'Enabled!';
			});
			mm('/disable_beats', () => {
				disable();
				return 'Disabled!';
			});
			mm('/help_spotify', /what commands are there for keyval/, () => {
				return `Commands are:\n${Bot.matches.matches
					.map((match) => {
						return `RegExps: ${match.regexps
							.map((r) => r.source)
							.join(', ')}. Texts: ${match.texts.join(', ')}}`;
					})
					.join('\n')}`;
			});

			fallback(({ state }) => {
				Bot.resetState(state);
			});
		}
	);

	public lastSubjects: string[] | null = null;

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
