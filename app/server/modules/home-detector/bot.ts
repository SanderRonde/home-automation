import { ResDummy } from '../../lib/logging/response-logger';
import { ChatState } from '../bot/message/state-keeping';
import { State as KeyValState } from '../keyval/bot';
import { LogObj } from '../../lib/logging/lob-obj';
import { BotStateBase } from '../../lib/bot-state';
import { MatchParameters } from '../bot/message';
import { MatchResponse } from '../bot/types';
import { Detector } from './classes';
import { HOME_STATE } from './types';
import { APIHandler } from './api';
import { HomeDetector } from '.';
import chalk from 'chalk';

interface State {
	lastSubjects: string[] | null;
}

interface HomeDetectorBotConfig {
	apiHandler: APIHandler;
	detector: Detector;
}

export class Bot extends BotStateBase {
	private static _config: HomeDetectorBotConfig | null = null;

	public static readonly commands = {
		'/whoshome': 'Check who is home',
		'/help_homedetector': 'Print help comands for home-detector',
	};

	public static readonly botName = 'Home-Detector';

	public static readonly matches = Bot.createMatchMaker(
		({ matchMaker: mm, fallbackSetter: fallback, conditional }) => {
			mm(
				'/whoshome',
				/who (is|are) (home|away)/,
				async ({ logObj, state, match }) => {
					const resDummy = new ResDummy();
					const all = Bot._config!.apiHandler.getAll(resDummy, {
						auth: await new (
							await HomeDetector.modules
						).auth.External(logObj).getSecretKey(),
					});
					LogObj.fromRes(resDummy).transferTo(logObj);

					const matches: string[] = [];
					for (const name in all) {
						if (
							(match[2] === 'home') ===
							(all[name] === HOME_STATE.HOME)
						) {
							matches.push(Bot.capitalize(name));
						}
					}

					const nameText = (() => {
						if (matches.length === 0) {
							return 'Noone is';
						} else if (matches.length === 1) {
							return `${matches[0]} is`;
						} else {
							return `${matches.slice(0, -1).join(', ')} and ${
								matches[matches.length - 1]
							} are`;
						}
					})();

					(
						state.states.homeDetector as unknown as State
					).lastSubjects = matches.length === 0 ? null : matches;

					return `${nameText}`;
				}
			);
			mm(/is (.*) (home|away)(\??)/, async ({ logObj, state, match }) => {
				const checkTarget = match[2];

				const resDummy = new ResDummy();
				const homeState = Bot._config!.apiHandler.get(resDummy, {
					auth: await new (await HomeDetector.modules).auth.External(
						logObj
					).getSecretKey(),
					name: match[1],
				});
				LogObj.fromRes(resDummy).transferTo(logObj);

				(state.states.homeDetector as unknown as State).lastSubjects = [
					match[1],
				];
				if (
					(homeState === HOME_STATE.HOME) ===
					(checkTarget === 'home')
				) {
					return 'Yep';
				} else {
					return 'Nope';
				}
			});
			mm(
				/when did (.*) (arrive|(get home)|leave|(go away))/,
				({ logObj, state, match }) => {
					const checkTarget =
						match[2] === 'arrive' || match[2] === 'get home'
							? HOME_STATE.HOME
							: HOME_STATE.AWAY;
					const target = match[1];

					const nameMsg = logObj.attachMessage(`Name: ${target}`);
					const pinger = Bot._config!.detector.getPinger(
						target.toLowerCase()
					);
					if (!pinger) {
						nameMsg.attachMessage(chalk.bold('Nonexistent'));
						return 'Person does not exist';
					}

					nameMsg.attachMessage(
						'Left at:',
						chalk.bold(String(pinger.leftAt))
					);
					nameMsg.attachMessage(
						'Arrived at:',
						chalk.bold(String(pinger.joinedAt))
					);

					(
						state.states.homeDetector as unknown as State
					).lastSubjects = [target];

					return checkTarget === HOME_STATE.HOME
						? pinger.joinedAt.toLocaleString()
						: pinger.leftAt.toLocaleString();
				}
			);

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
						for (const target of (
							state.states.homeDetector as unknown as State
						).lastSubjects!) {
							const nameMsg = logObj.attachMessage(
								`Name: ${target}`
							);
							const pinger = Bot._config!.detector.getPinger(
								target.toLowerCase()
							);
							if (!pinger) {
								nameMsg.attachMessage(
									chalk.bold('Nonexistent')
								);
								continue;
							}

							nameMsg.attachMessage(
								'Left at:',
								chalk.bold(String(pinger.leftAt))
							);
							nameMsg.attachMessage(
								'Arrived at:',
								chalk.bold(String(pinger.joinedAt))
							);

							const timeMsg =
								checkTarget === HOME_STATE.HOME
									? pinger.joinedAt.toLocaleString()
									: pinger.leftAt.toLocaleString();
							table.contents.push([
								Bot.capitalize(target),
								timeMsg,
							]);
						}

						return Bot.makeTable(table);
					}
				),
				({ state }) => {
					return (
						(state.states.homeDetector as unknown as State)
							.lastSubjects !== null
					);
				}
			);

			mm(
				'/help_homedetector',
				/what commands are there for home(-| )?detector/,
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

	public static async match(
		config: MatchParameters
	): Promise<MatchResponse | undefined> {
		return await this.matchLines({
			...config,
			matchConfig: Bot.matches,
		});
	}

	public static resetState(state: ChatState): void {
		(state.states.keyval as unknown as KeyValState).lastSubjects = null;
	}

	public toJSON(): State {
		return {
			lastSubjects: this.lastSubjects,
		};
	}
}
