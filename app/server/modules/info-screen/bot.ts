import { BotState } from '../../lib/bot-state';
import { attachMessage } from '../../lib/logger';
import { MatchParameters } from '../bot/message';
import { MatchResponse } from '../bot/types';
import { refreshClients } from './routing';

export class Bot extends BotState.Base {
	static readonly commands = {
		'/info_refresh': 'Refresh info-screen',
	};

	static readonly botName = 'InfoScreen';

	static readonly matches = Bot.createMatchMaker(({ matchMaker: mm }) => {
		mm('/info_refresh', /refresh info screen/, ({ logObj }) => {
			const amount = refreshClients();
			attachMessage(logObj, `Refreshed ${amount} clients`);
			return `Refreshed ${amount} clients`;
		});
	});

	constructor(_json?: Record<string, never>) {
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
