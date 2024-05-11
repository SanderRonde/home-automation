import { BotStateBase } from '@server/lib/bot-state';
import { attachMessage } from '@server/lib/logger';
import { MatchParameters } from '@server/modules/bot/message';
import { MatchResponse } from '@server/modules/bot/types';
import { refreshClients } from '@server/modules/info-screen/routing';

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
