import { BotState } from '../../lib/bot-state';
import { attachMessage } from '../../lib/logger';
import { getInTimeWindow } from './explaining';
import { Bot as _Bot } from '../bot';
import { KeyVal } from '../keyval';

export interface JSON {
	lastSubjects: string[] | null;
}

export class Bot extends BotState.Base {
	static readonly commands = {
		'/explain': 'Explain actions in last 5 minutes',
		'/explainv': 'Explain actions in last 5 minutes with additional logs',
		'/explain15': 'Explain actions in last 15 minutes',
		'/explainv15': 'Explain actions in last 15 minutes',
		'/help_explain': 'Print help comands for explain',
	};

	static readonly botName = 'Explain';

	static readonly matches = Bot.createMatchMaker(
		({ matchMaker: mm, fallbackSetter: fallback }) => {
			mm(
				/\/explainv(\d+)?/,
				/explain v(erbose)? last (\d+) minutes/,
				/explainv/,
				async ({ match, logObj }) => {
					const minutes =
						match.length && match[1] ? parseInt(match[1], 10) : 5;
					const actions = getInTimeWindow(1000 * 60 * minutes);

					attachMessage(
						logObj,
						`Showing verbose last ${minutes} minutes of actions`,
						JSON.stringify(actions)
					);

					return (
						await Promise.all(
							actions.map(async (action) => {
								const logs = await (async () => {
									if (!action.logs) {
										return 'null';
									}
									const lines = await action.logs.get();
									return lines;
								})();
								return `Time: ${new Date(
									action.timestamp
								).toLocaleTimeString()}\nModule: ${
									action.moduleName
								}\nSource: ${action.source}\nDescription: ${
									action.description
								}\n${logs}\n`;
							})
						)
					).join('\n');
				}
			);
			mm(
				/\/explain(\d+)?/,
				/explain last (\d+) minutes/,
				/explain/,
				({ match, logObj }) => {
					const minutes =
						match.length && match[1] ? parseInt(match[1], 10) : 5;
					const actions = getInTimeWindow(1000 * 60 * minutes);

					attachMessage(
						logObj,
						`Showing last ${minutes} minutes of actions`,
						JSON.stringify(actions)
					);

					return actions
						.map((action) => {
							return `Time: ${new Date(
								action.timestamp
							).toLocaleTimeString()}\nModule: ${
								action.moduleName
							}\nSource: ${action.source}\nDescription: ${
								action.description
							}\n`;
						})
						.join('\n');
				}
			);
			mm('/help_explain', /what commands are there for explain/, () => {
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

	lastSubjects: string[] | null = null;

	constructor(json?: JSON) {
		super();
		if (json) {
			this.lastSubjects = json.lastSubjects;
		}
	}

	static async match(
		config: _Bot.Message.MatchParameters
	): Promise<_Bot.Message.MatchResponse | undefined> {
		return await this.matchLines({
			...config,
			matchConfig: Bot.matches,
		});
	}

	static resetState(state: _Bot.Message.StateKeeping.ChatState): void {
		(state.states.keyval as unknown as KeyVal.Bot.JSON).lastSubjects = null;
	}

	toJSON(): JSON {
		return {
			lastSubjects: this.lastSubjects,
		};
	}
}
