import { Bot } from '../modules/bot';
import { attachMessage } from './logger';

export namespace BotState {
	export type MatchHandler = (config: { 
		text: string;
		message: Bot.TelegramMessage;
		state: Bot.Message.StateKeeping.ChatState;
		match: RegExpMatchArray;
		logObj: any;
	}) => (string | number | Promise<string | number>);

	export interface MatchBaseParams {
		text: string;
		message: Bot.TelegramMessage;
		state: Bot.Message.StateKeeping.ChatState;
	}

	export interface MatchParams extends MatchBaseParams {
		logObj: any;
	}

	export type MatchFallback = (config: MatchBaseParams) => void;

	export interface MatchConfig {
		matches: MatchData[];
		fallback: MatchFallback;
	}

	export interface MatchData {
		fn: MatchHandler;
		texts: string[];
		regexps: RegExp[];
		conditions: ((params: MatchParams) => boolean)[];
	}

	export type MatchMaker = (...args: (string[]|string|RegExp[]|RegExp|MatchHandler)[]) => void;

	export type SameMaker = (str: TemplateStringsArray, ...values: string[][]) => string[];

	export abstract class Matchable {
		static async match({ }: MatchParams): Promise<Bot.Message.MatchResponse | undefined> {
			throw new Error('Not implemented');
		}

		static async matchLines(config: MatchParams & {
			matchConfig: MatchConfig;
		}): Promise<Bot.Message.MatchResponse | undefined> {
			let { logObj, text, matchConfig } = config;

			let index: number = -1;
			let match: RegExpExecArray | null = null;
			text = text.toLowerCase();
			for (const { fn, regexps, texts, conditions } of matchConfig.matches) {
				for (const matchText of texts) {
					if ((index = text.indexOf(matchText)) > -1 && conditions.every((condition) => {
						return condition(config);
					})) {
						const newLogObj = attachMessage(logObj,
							`Matching Str: ${matchText}`);
						return {
							end: index + matchText.length,
							response: await fn({ ...config, logObj: newLogObj, match: [] as any }) + ''
						}
					}
				}
				for (const matchRegexp of regexps) {
					if ((match = matchRegexp.exec(text)) && conditions.every((condition) => {
						return condition(config);
					})) {
						const newLogObj = attachMessage(logObj,
							`Matching Regex: ${matchRegexp}`);
						return {
							end: match.index + match[0].length,
							response: await fn({ ...config, logObj: newLogObj, match }) + ''
						}
					}
				}
			}

			matchConfig.fallback(config);

			return undefined;
		}

		static createMatch(...args: (string[]|string|RegExp[]|RegExp|MatchHandler)[]): MatchData {
			const matchData: Partial<MatchData> = {
				regexps: [],
				texts: [],
				conditions: []
			}

			for (const arg of args) {
				if (typeof arg === 'function') {
					matchData.fn = arg;
					continue;
				}

				const innerArgs = Array.isArray(arg) ?
					arg : [arg];
				for (const innerArg of innerArgs) {
					if (typeof innerArg === 'string') {
						matchData.texts!.push(innerArg.toLowerCase());
					} else if (typeof innerArg === 'object') {
						matchData.regexps!.push(new RegExp(innerArg, 
							innerArg.flags.includes('i') ?
								innerArg.flags : 
								innerArg.flags + 'i'));
					} else {
						throw new Error('Invalid type passed: ' + innerArg);
					}
				}
			}


			if (!matchData.fn) {
				throw new Error('No fn handler supplied');
			}

			return matchData as MatchData;
		}

		static flatten<V>(arrays: V[][]): V[] {
			const flattened: V[] = [];
			
			for (const arr of arrays) {
				flattened.push(...arr);
			}
			
			return flattened;
		}

		static splitAtWord(pre: string, options: string[], post: {
			str: string[];
			values: string[][];
		}): string[] {
			const joinedOptions: string[] = [];

			for (const option of options) {
				joinedOptions.push(`${pre}${option}`);
			}

			if (post.values.length === 0) {
				// Only one string left, it must be the final one
				return joinedOptions.map(o => `${o}${post.str[0]}`);
			}

			return this.flatten(joinedOptions.map((joinedOption) => {
				return this.splitAtWord(`${joinedOption}${post.str[0]}`, post.values[0], {
					str: post.str.slice(1),
					values: post.values.slice(1)
				});
			}))
		}

		static createJoinedWords(str: TemplateStringsArray, ...values: string[][]): string[] {
			if (values.length === 0) {
				return [str[0]];
			}

			return this.splitAtWord(str[0], values[0], {
				str: str.slice(1),
				values: values.slice(1)
			})
		}

		// Used for typing
		static createMatchMaker(fn: (params: {
			matchMaker: MatchMaker;
			sameWordMaker: SameMaker;
			fallbackSetter: (fallback: MatchFallback) => void;
			conditional: (match: MatchData, condition: (params: MatchParams) => boolean) => void;
		}) => any): MatchConfig {
			const config: MatchConfig = {
				matches: [],
				fallback: () => {}
			}

			fn({
				matchMaker: (...args: (string[]|RegExp[]|MatchHandler)[]) => {
					config.matches.push(this.createMatch(...args));
				},
				sameWordMaker: (str: TemplateStringsArray, ...values: string[][]): string[] => {
					return this.createJoinedWords(str, ...values);
				}, 
				fallbackSetter: (fn) => {
					config.fallback = fn;
				},
				conditional: (match, condition) => {
					match.conditions.push(condition);
				}
			});

			return config;
		}

		static readonly matches: MatchConfig;

		static resetState(_state: Bot.Message.StateKeeping.ChatState) {
			throw new Error('Not implemented');
		}
	}

	export abstract class Base extends Matchable {
		abstract toJSON(): any;
	}
}