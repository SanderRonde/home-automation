import type { ChatState } from '../bot/message/state-keeping';
import type { MatchParameters } from '../bot/message';
import { BotStateBase } from '../../lib/bot-state';
import type { MatchResponse } from '../bot/types';
import type { Detector } from './classes';
import { HOME_STATE } from './types';
import chalk from 'chalk';

interface State {
	lastSubjects: string[] | null;
}

interface HomeDetectorBotConfig {
	detector: Detector;
}

export class Bot extends BotStateBase {
	private static _config: HomeDetectorBotConfig | null = null;

	public static override readonly commands = {
		'/whoshome': 'Check who is home',
		'/help_homedetector': 'Print help comands for home-detector',
	};

	public static override readonly botName = 'Home-Detector';

	public static override readonly matches = Bot.createMatchMaker(
		({ matchMaker: mm, fallbackSetter: fallback, conditional }) => {
			mm('/whoshome', /who (is|are) (home|away)/, ({ state, match }) => {
				const all = Bot._config!.detector.getAll();

				const matches: string[] = [];
				for (const name in all) {
					if ((match[2] === 'home') === (all[name] === HOME_STATE.HOME)) {
						matches.push(Bot.capitalize(name));
					}
				}

				const nameText = (() => {
					if (matches.length === 0) {
						return 'Noone is';
					} else if (matches.length === 1) {
						return `${matches[0]} is`;
					} else {
						return `${matches.slice(0, -1).join(', ')} and ${matches[matches.length - 1]} are`;
					}
				})();

				(state.states.homeDetector as unknown as State).lastSubjects =
					matches.length === 0 ? null : matches;

				return `${nameText}`;
			});
			mm(/is (.*) (home|away)(\??)/, ({ state, match }) => {
				const checkTarget = match[2];

				const homeState = Bot._config!.detector.get(match[1]);

				(state.states.homeDetector as unknown as State).lastSubjects = [match[1]];
				if ((homeState === HOME_STATE.HOME) === (checkTarget === 'home')) {
					return 'Yep';
				} else {
					return 'Nope';
				}
			});
			mm(/when did (.*) (arrive|(get home)|leave|(go away))/, ({ logObj, state, match }) => {
				const checkTarget =
					match[2] === 'arrive' || match[2] === 'get home'
						? HOME_STATE.HOME
						: HOME_STATE.AWAY;
				const target = match[1];

				const nameMsg = logObj.attachMessage(`Name: ${target}`);
				const pinger = Bot._config!.detector.getPinger(target.toLowerCase());
				if (!pinger) {
					nameMsg.attachMessage(chalk.bold('Nonexistent'));
					return 'Person does not exist';
				}

				nameMsg.attachMessage('Left at:', chalk.bold(String(pinger.leftAt)));
				nameMsg.attachMessage('Arrived at:', chalk.bold(String(pinger.joinedAt)));

				(state.states.homeDetector as unknown as State).lastSubjects = [target];

				return checkTarget === HOME_STATE.HOME
					? (pinger.joinedAt?.toLocaleString() ?? 'Unknown')
					: (pinger.leftAt?.toLocaleString() ?? 'Unknown');
			});

			conditional(
				mm(
					/when did (he|she|they) (arrive|(get home)|leave|(go away))/,
					({ logObj, state, match }) => {
						const checkTarget =
							match[2] === 'arrive' || match[2] === 'get home'
								? HOME_STATE.HOME
								: HOME_STATE.AWAY;

						const table: {
							contents: string[][];
							header: string[];
						} = {
							contents: [],
							header: ['Name', 'Time'],
						};
						for (const target of (state.states.homeDetector as unknown as State)
							.lastSubjects!) {
							const nameMsg = logObj.attachMessage(`Name: ${target}`);
							const pinger = Bot._config!.detector.getPinger(target.toLowerCase());
							if (!pinger) {
								nameMsg.attachMessage(chalk.bold('Nonexistent'));
								continue;
							}

							nameMsg.attachMessage('Left at:', chalk.bold(String(pinger.leftAt)));
							nameMsg.attachMessage(
								'Arrived at:',
								chalk.bold(String(pinger.joinedAt))
							);

							const timeMsg =
								checkTarget === HOME_STATE.HOME
									? (pinger.joinedAt?.toLocaleString() ?? 'Unknown')
									: (pinger.leftAt?.toLocaleString() ?? 'Unknown');
							table.contents.push([Bot.capitalize(target), timeMsg]);
						}

						return Bot.makeTable(table);
					}
				),
				({ state }) => {
					return (state.states.homeDetector as unknown as State).lastSubjects !== null;
				}
			);

			mm('/help_homedetector', /what commands are there for home(-| )?detector/, () => {
				return `Commands are:\n${Bot.matches.matches
					.map((match) => {
						return `RegExps: ${match.regexps.map((r) => r.source).join(', ')}. Texts: ${match.texts.join(
							', '
						)}}`;
					})
					.join('\n')}`;
			});

			fallback(({ state }) => {
				Bot.resetState(state);
			});
		}
	);

	public lastSubjects: string[] | null = null;

	public constructor(json?: State) {
		super();
		if (json) {
			this.lastSubjects = json.lastSubjects;
		}
	}

	public static init(config: HomeDetectorBotConfig): void {
		this._config = config;
	}

	public static override async match(
		config: MatchParameters
	): Promise<MatchResponse | undefined> {
		return await this.matchLines({
			...config,
			matchConfig: Bot.matches,
		});
	}

	public static override resetState(state: ChatState): void {
		(state.states.homeDetector as unknown as State).lastSubjects = null;
	}

	public toJSON(): State {
		return {
			lastSubjects: this.lastSubjects,
		};
	}
}
