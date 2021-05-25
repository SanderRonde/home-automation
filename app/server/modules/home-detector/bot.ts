import chalk from 'chalk';
import { HOME_STATE } from './types';
import { BotState } from '../../lib/bot-state';
import { attachMessage, ResDummy } from '../../lib/logger';
import { Auth } from '../auth';
import { KeyVal } from '../keyval';
import { APIHandler } from './api';
import { Detector } from './classes';
import { Bot as _Bot } from '../bot';

export interface State {
	lastSubjects: string[] | null;
}

interface HomeDetectorBotConfig {
	apiHandler: APIHandler;
	detector: Detector;
}

export class Bot extends BotState.Base {
	static readonly commands = {
		'/whoshome': 'Check who is home',
		'/help_homedetector': 'Print help comands for home-detector',
	};

	static readonly botName = 'Home-Detector';

	static readonly matches = Bot.createMatchMaker(
		({ matchMaker: mm, fallbackSetter: fallback, conditional }) => {
			mm(
				'/whoshome',
				/who (is|are) (home|away)/,
				async ({ logObj, state, match }) => {
					const resDummy = new ResDummy();
					const all = await Bot._config!.apiHandler.getAll(
						resDummy,
						{
							// TODO: replace with external
							auth: Auth.Secret.getKey(),
						},
						'BOT.WHOSHOME'
					);
					resDummy.transferTo(logObj);

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
				const homeState = await Bot._config!.apiHandler.get(
					resDummy,
					{
						auth: Auth.Secret.getKey(),
						name: match[1],
					},
					'BOT.IS_HOME'
				);
				resDummy.transferTo(logObj);

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

					const nameMsg = attachMessage(logObj, `Name: ${target}`);
					const pinger = Bot._config!.detector.getPinger(
						target.toLowerCase()
					);
					if (!pinger) {
						attachMessage(nameMsg, chalk.bold('Nonexistent'));
						return 'Person does not exist';
					}

					attachMessage(
						nameMsg,
						'Left at:',
						chalk.bold(String(pinger.leftAt))
					);
					attachMessage(
						nameMsg,
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
							const nameMsg = attachMessage(
								logObj,
								`Name: ${target}`
							);
							const pinger = Bot._config!.detector.getPinger(
								target.toLowerCase()
							);
							if (!pinger) {
								attachMessage(
									nameMsg,
									chalk.bold('Nonexistent')
								);
								continue;
							}

							attachMessage(
								nameMsg,
								'Left at:',
								chalk.bold(String(pinger.leftAt))
							);
							attachMessage(
								nameMsg,
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

	private static _config: HomeDetectorBotConfig | null = null;
	lastSubjects: string[] | null = null;

	constructor(json?: State) {
		super();
		if (json) {
			this.lastSubjects = json.lastSubjects;
		}
	}

	static init(config: HomeDetectorBotConfig): void {
		this._config = config;
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

	toJSON(): State {
		return {
			lastSubjects: this.lastSubjects,
		};
	}
}
