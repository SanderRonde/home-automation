import { BotStateBase } from '../../lib/bot-state';
import { MatchParameters } from '../bot/message';
import { attachMessage } from '../../lib/logger';
import { MatchResponse } from '../bot/types';
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
				attachMessage(logObj, `Refreshed ${amount} clients`);
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
