import { COMMON_SWITCH_MAPPINGS } from '@server/config/led-config';
import { ChatState } from '@server/modules/bot/message/state-keeping';
import { BotStateBase } from '@server/lib/bot-state';
import { MatchParameters } from '@server/modules/bot/message';
import { MatchResponse } from '@server/modules/bot/types';
import { ExternalHandler } from '@server/modules/keyval/external';

export interface State {
	lastSubjects: string[] | null;
}

export class Bot extends BotStateBase {
	public static readonly commands = {
		'/islighton': 'Check if the light is on',
		'/lightoff': 'Turn off the light',
		'/lighton': 'Turn on the light',
		'/help_keyval': 'Print help comands for keyval',
	};

	public static readonly botName = 'Keyval';

	public static readonly matches = Bot.createMatchMaker(
		({ matchMaker: mm, fallbackSetter: fallback, conditional }) => {
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

	public lastSubjects: string[] | null = null;

	public constructor(json?: State) {
		super();
		if (json) {
			this.lastSubjects = json.lastSubjects;
		}
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
		(state.states.keyval as unknown as State).lastSubjects = null;
	}

	public toJSON(): State {
		return {
			lastSubjects: this.lastSubjects,
		};
	}
}
