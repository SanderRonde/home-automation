import { BotState } from '../../lib/bot-state';
import { COMMON_SWITCH_MAPPINGS, MAIN_LIGHTS } from '../../lib/constants';
import { MatchParameters } from '../bot/message';
import { ChatState } from '../bot/message/state-keeping';
import { MatchResponse } from '../bot/types';
import { ExternalHandler } from './external';

export interface State {
	lastSubjects: string[] | null;
}

export class Bot extends BotState.Base {
	static readonly commands = {
		'/islighton': 'Check if the light is on',
		'/lightoff': 'Turn off the light',
		'/lighton': 'Turn on the light',
		'/help_keyval': 'Print help comands for keyval',
	};

	static readonly botName = 'Keyval';

	static readonly matches = Bot.createMatchMaker(
		({ matchMaker: mm, fallbackSetter: fallback, conditional }) => {
			mm(
				'/islighton',
				/is the light (on|off)/,
				/are the lights (on|off)/,
				async ({ match, logObj, state, matchText }) => {
					const results = await Promise.all(
						MAIN_LIGHTS.map((light) => {
							return new ExternalHandler(
								logObj,
								`BOT.${matchText}`
							).get(light);
						})
					);

					const actualState = (() => {
						if (results.every((v) => v === '1')) {
							return 'ON';
						}
						if (results.every((v) => v === '0')) {
							return 'OFF';
						}
						return 'BETWEEN';
					})();

					(state.states.keyval as unknown as State).lastSubjects =
						MAIN_LIGHTS;

					switch (actualState) {
						case 'ON':
							return !match.length || match[1] === 'on'
								? 'Yep'
								: 'Nope';
						case 'OFF':
							return match.length && match[1] === 'off'
								? 'Yep'
								: 'Nope';
						default:
							return 'Some are on some are off';
					}
				}
			);
			mm('/lighton', async ({ logObj, state, matchText }) => {
				(state.states.keyval as unknown as State).lastSubjects =
					MAIN_LIGHTS;
				await Promise.all(
					MAIN_LIGHTS.map((light) => {
						return new ExternalHandler(
							logObj,
							`BOT.${matchText}`
						).set(light, '1');
					})
				);
				return `Turned ${MAIN_LIGHTS.length > 1 ? 'them' : 'it'} on`;
			});
			mm('/lightoff', async ({ logObj, state, matchText }) => {
				(state.states.keyval as unknown as State).lastSubjects =
					MAIN_LIGHTS;
				await Promise.all(
					MAIN_LIGHTS.map((light) => {
						return new ExternalHandler(
							logObj,
							`BOT.${matchText}`
						).set(light, '0');
					})
				);
				return `Turned ${MAIN_LIGHTS.length > 1 ? 'them' : 'it'} off`;
			});
			for (const [reg, switchName] of COMMON_SWITCH_MAPPINGS) {
				mm(
					new RegExp('turn (on|off) ' + reg.source),
					async ({ logObj, state, match, matchText }) => {
						const keyvalState = match[1];
						(state.states.keyval as unknown as State).lastSubjects =
							[switchName];
						await new ExternalHandler(
							logObj,
							`BOT.${matchText}`
						).set(switchName, keyvalState === 'on' ? '1' : '0');
						return `Turned it ${keyvalState}`;
					}
				);
				mm(
					new RegExp('is ' + reg.source + ' (on|off)'),
					async ({ logObj, state, match, matchText }) => {
						const keyvalState = match.pop();
						(state.states.keyval as unknown as State).lastSubjects =
							[switchName];
						const res = await new ExternalHandler(
							logObj,
							`BOT.${matchText}`
						).get(switchName);
						if ((res === '1') === (keyvalState === 'on')) {
							return 'Yep';
						} else {
							return 'Nope';
						}
					}
				);
			}
			conditional(
				mm(
					/turn (it|them) (on|off)( again)?/,
					async ({ state, logObj, match, matchText }) => {
						for (const lastSubject of (
							state.states.keyval as unknown as State
						).lastSubjects!) {
							await new ExternalHandler(
								logObj,
								`BOT.${matchText}`
							).set(lastSubject, match[2] === 'on' ? '1' : '0');
						}
						return `Turned ${match[1]} ${match[2]}`;
					}
				),
				({ state }) => {
					return (
						(state.states.keyval as unknown as State)
							.lastSubjects !== null
					);
				}
			);
			mm('/help_keyval', /what commands are there for keyval/, () => {
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

	constructor(json?: State) {
		super();
		if (json) {
			this.lastSubjects = json.lastSubjects;
		}
	}

	static async match(
		config: MatchParameters
	): Promise<MatchResponse | undefined> {
		return await this.matchLines({
			...config,
			matchConfig: Bot.matches,
		});
	}

	static resetState(state: ChatState): void {
		(state.states.keyval as unknown as State).lastSubjects = null;
	}

	toJSON(): State {
		return {
			lastSubjects: this.lastSubjects,
		};
	}
}
