import { Bot } from '../modules/bot';

export namespace BotState {
	export type MatchSet = [
		RegExp | RegExp[] | string | string[],
		(config: { text: string, message: Bot.TelegramMessage, state: Bot.Message.StateKeeping.ChatState, match: RegExpMatchArray }) => (string | number | Promise<string | number>)
	][];

	export abstract class Matchable {
		abstract async match(text: string, message: Bot.TelegramMessage, state: Bot.Message.StateKeeping.ChatState): Promise<Bot.Message.MatchResponse | undefined>;

		async matchLines(text: string, config: {
			text: string;
			message: Bot.TelegramMessage;
			state: Bot.Message.StateKeeping.ChatState
		}, matchers: MatchSet): Promise<Bot.Message.MatchResponse | undefined> {
			let index: number = -1;
			let match: RegExpExecArray | null = null;
			text = text.toLowerCase();
			for (const [matchTexts, matchFn] of matchers) {
				for (let matchText of Array.isArray(matchTexts) ? matchTexts : [matchTexts]) {
					if (typeof matchText === 'object') {
						if ((match = matchText.exec(text))) {
							return {
								end: match.index + match[0].length,
								response: await matchFn({ ...config, match }) + ''
							}
						}
					} else {
						if ((index = text.indexOf(matchText)) > -1) {
							return {
								end: index + matchText.length,
								response: await matchFn({ ...config, match: [] as any }) + ''
							}
						}
					}
				}
			}
			return undefined;
		}

		// Used for typing
		static createMatches(matches: MatchSet) {
			return matches;
		}

		static readonly matches: MatchSet;
	}

	export abstract class Base extends Matchable {
		abstract toJSON(): any;
	}
}