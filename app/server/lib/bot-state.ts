import { Bot, RESPONSE_TYPE } from '../modules/bot';
import { attachMessage } from './logger';
import { BotUtil } from './bot-util';
import chalk from 'chalk';

export namespace BotState {
	export type MatchHandlerRet =
		| string
		| number
		| {
				type: RESPONSE_TYPE;
				text: string | number;
		  }
		| Promise<
				| string
				| number
				| {
						type: RESPONSE_TYPE;
						text: string | number;
				  }
		  >;

	export interface MatchHandlerParams {
		text: string;
		message: Bot.TelegramMessage;
		state: Bot.Message.StateKeeping.ChatState;
		match: RegExpMatchArray;
		matchText: string;
		logObj: any;
		ask(question: string): Promise<string | undefined>;
		askCancelable(question: string): {
			cancel(): void;
			prom: Promise<string | undefined>;
		};
		sendText(text: string): Promise<boolean>;
	}

	export type MatchHandler = (config: MatchHandlerParams) => MatchHandlerRet;

	export interface MatchBaseParams {
		text: string;
		message: Bot.TelegramMessage;
		state: Bot.Message.StateKeeping.ChatState;
		bot: Bot.Message.Handler;
		res: Bot.Message.ResWrapper;
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

	export type MatchMaker = (
		...args: (string[] | string | RegExp[] | RegExp | MatchHandler)[]
	) => MatchData;

	export type SameMaker = (
		str: TemplateStringsArray,
		...values: string[][]
	) => string[];

	export abstract class Matchable extends BotUtil.BotUtil {
		static async match({}: MatchParams): Promise<
			Bot.Message.MatchResponse | undefined
		> {
			return undefined;
		}

		static async matchLines(
			config: MatchParams & {
				matchConfig: MatchConfig;
			}
		): Promise<Bot.Message.MatchResponse | undefined> {
			let { logObj, text, matchConfig } = config;

			let index: number = -1;
			let match: RegExpExecArray | null = null;
			text = text.toLowerCase();
			let earliestMatch: {
				type: 'text' | 'regexp';
				index: number;
				match: RegExpExecArray;
				fn: MatchHandler;
				matchText: string;
				end: number;
			} | null = null;

			for (const {
				fn,
				regexps,
				texts,
				conditions,
			} of matchConfig.matches) {
				for (const matchText of texts) {
					if (
						(index = text.indexOf(matchText)) === 0 &&
						conditions.every((condition) => {
							return condition(config);
						})
					) {
						if (
							earliestMatch === null ||
							index < earliestMatch!.index
						) {
							earliestMatch = {
								type: 'text',
								match: [] as unknown as RegExpExecArray,
								fn,
								index,
								matchText,
								end: index + matchText.length,
							};
						}
					}
				}
				for (const matchRegexp of regexps) {
					if (
						(match = new RegExp('^' + matchRegexp.source).exec(
							text
						)) &&
						conditions.every((condition) => {
							return condition(config);
						})
					) {
						if (
							earliestMatch === null ||
							match.index < earliestMatch!.index
						) {
							earliestMatch = {
								type: 'text',
								match,
								fn,
								index: match.index,
								matchText: matchRegexp.source,
								end: match.index + match[0].length,
							};
						}
					}
				}
			}

			if (earliestMatch) {
				const newLogObj = attachMessage(
					logObj,
					earliestMatch!.type === 'text'
						? 'Matching string:'
						: 'Matching regex:',
					chalk.bold(earliestMatch!.matchText)
				);
				return {
					end: earliestMatch!.end,
					response: await earliestMatch!.fn({
						...config,
						logObj: newLogObj,
						match: earliestMatch!.match,
						matchText: earliestMatch!.matchText,
						ask(question: string) {
							return config.bot.askQuestion(
								question,
								config.message,
								config.res
							);
						},
						askCancelable(question: string) {
							let _cancel: () => void;
							return {
								prom: config.bot.askCancelable(
									question,
									config.message,
									config.res,
									(cancel) => {
										_cancel = cancel;
									}
								),
								cancel() {
									_cancel && _cancel();
								},
							};
						},
						sendText(text: string) {
							return config.bot.sendText(
								text,
								config.message,
								config.res
							);
						},
					}),
				};
			}

			matchConfig.fallback(config);

			return undefined;
		}

		static createMatch(
			...args: (string[] | string | RegExp[] | RegExp | MatchHandler)[]
		): MatchData {
			const matchData: Partial<MatchData> = {
				regexps: [],
				texts: [],
				conditions: [],
			};

			for (const arg of args) {
				if (typeof arg === 'function') {
					matchData.fn = arg;
					continue;
				}

				const innerArgs = Array.isArray(arg) ? arg : [arg];
				for (const innerArg of innerArgs) {
					if (typeof innerArg === 'string') {
						matchData.texts!.push(innerArg.toLowerCase());
					} else if (typeof innerArg === 'object') {
						matchData.regexps!.push(
							new RegExp(
								innerArg,
								innerArg.flags.includes('i')
									? innerArg.flags
									: innerArg.flags + 'i'
							)
						);
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

		static splitAtWord(
			pre: string,
			options: string[],
			post: {
				str: string[];
				values: string[][];
			}
		): string[] {
			const joinedOptions: string[] = [];

			for (const option of options) {
				joinedOptions.push(`${pre}${option}`);
			}

			if (post.values.length === 0) {
				// Only one string left, it must be the final one
				return joinedOptions.map((o) => `${o}${post.str[0]}`);
			}

			return this.flatten(
				joinedOptions.map((joinedOption) => {
					return this.splitAtWord(
						`${joinedOption}${post.str[0]}`,
						post.values[0],
						{
							str: post.str.slice(1),
							values: post.values.slice(1),
						}
					);
				})
			);
		}

		static createJoinedWords(
			str: TemplateStringsArray,
			...values: string[][]
		): string[] {
			if (values.length === 0) {
				return [str[0]];
			}

			return this.splitAtWord(str[0], values[0], {
				str: str.slice(1),
				values: values.slice(1),
			});
		}

		// Used for typing
		static createMatchMaker(
			fn: (params: {
				matchMaker: MatchMaker;
				sameWordMaker: SameMaker;
				fallbackSetter: (fallback: MatchFallback) => void;
				conditional: (
					match: MatchData,
					condition: (params: MatchParams) => boolean
				) => void;
			}) => any
		): MatchConfig {
			const config: MatchConfig = {
				matches: [],
				fallback: () => {},
			};

			fn({
				matchMaker: (
					...args: (string[] | RegExp[] | MatchHandler)[]
				) => {
					const match = this.createMatch(...args);
					config.matches.push(match);
					return match;
				},
				sameWordMaker: (
					str: TemplateStringsArray,
					...values: string[][]
				): string[] => {
					return this.createJoinedWords(str, ...values);
				},
				fallbackSetter: (fn) => {
					config.fallback = fn;
				},
				conditional: (match, condition) => {
					match.conditions.push(condition);
				},
			});

			return config;
		}

		static readonly matches: MatchConfig;

		static readonly commands: {
			[command: string]: string;
		} = {};

		static readonly botName: string;

		static resetState(_state: Bot.Message.StateKeeping.ChatState) {}
	}

	export abstract class Base extends Matchable {
		abstract toJSON(): any;
	}
}
