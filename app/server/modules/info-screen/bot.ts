import type { MatchParameters } from '../bot/message';
import { BotStateBase } from '../../lib/bot-state';
import type { MatchResponse } from '../bot/types';
import { refreshClients } from './routing';

export class Bot extends BotStateBase {
	public static readonly commands = {
		'/info_refresh': 'Refresh info-screen',
	};

	public static readonly botName = 'InfoScreen';

	public static readonly matches = Bot.createMatchMaker(
		({ matchMaker: mm }) => {
			mm('/info_refresh', /refresh info screen/, ({ logObj }) => {
				const amount = refreshClients();
				logObj.attachMessage(`Refreshed ${amount} clients`);
				return `Refreshed ${amount} clients`;
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
