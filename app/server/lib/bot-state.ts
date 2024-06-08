import type { MatchResponse, TelegramMessage } from '../modules/bot/types';
import type { MessageHandler, ResWrapper } from '../modules/bot/message';
import type { ChatState } from '../modules/bot/message/state-keeping';
import { RESPONSE_TYPE } from '../modules/bot/types';
import type { LogObj } from './logging/lob-obj';
import { BotUtil } from './bot-util';
import { wait } from './util';
import chalk from 'chalk';

type MatchHandlerRet =
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
	message: TelegramMessage;
	state: ChatState;
	match: RegExpMatchArray;
	matchText: string;
	logObj: LogObj;
	ask(question: string): Promise<string | undefined>;
	askCancelable(
		this: void,
		question: string
	): {
		cancel(): void;
		prom: Promise<string | undefined>;
	};
	sendText(text: string): Promise<boolean>;
}

type MatchHandler = (config: MatchHandlerParams) => MatchHandlerRet;

interface MatchBaseParams {
	text: string;
	message: TelegramMessage;
	state: ChatState;
	bot: MessageHandler;
	res: ResWrapper;
}

interface MatchParams extends MatchBaseParams {
	logObj: LogObj;
}

type MatchFallback = (config: MatchBaseParams) => void;

interface MatchConfig {
	matches: MatchData[];
	fallback: MatchFallback;
}

interface MatchData {
	fn: MatchHandler;
	texts: string[];
	regexps: RegExp[];
	conditions: ((params: MatchParams) => boolean)[];
}

type MatchMaker = (
	...args: (string[] | string | RegExp[] | RegExp | MatchHandler)[]
) => MatchData;

type SameMaker = (str: TemplateStringsArray, ...values: string[][]) => string[];

export abstract class Matchable extends BotUtil {
	public static readonly matches: MatchConfig;

	public static readonly commands: {
		[command: string]: string;
	} = {};

	public static readonly botName: string;

	public static match(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_params: MatchParams
	): Promise<MatchResponse | undefined> {
		return Promise.resolve(undefined);
	}

	public static async matchLines(
		config: MatchParams & {
			matchConfig: MatchConfig;
		}
	): Promise<MatchResponse | undefined> {
		const { logObj, matchConfig } = config;
		let { text } = config;

		let index = -1;
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

		for (const { fn, regexps, texts, conditions } of matchConfig.matches) {
			for (const matchText of texts) {
				if (
					(index = text.indexOf(matchText)) === 0 &&
					conditions.every((condition) => {
						return condition(config);
					})
				) {
					if (earliestMatch === null || index < earliestMatch.index) {
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
					(match = new RegExp('^' + matchRegexp.source).exec(text)) &&
					conditions.every((condition) => {
						return condition(config);
					})
				) {
					if (
						earliestMatch === null ||
						match.index < earliestMatch.index
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
			const newLogObj = logObj.attachMessage(
				earliestMatch.type === 'text'
					? 'Matching string:'
					: 'Matching regex:',
				chalk.bold(earliestMatch.matchText)
			);
			const getResponse = () => {
				// eslint-disable-next-line no-async-promise-executor
				return new Promise<MatchHandlerRet>(async (resolve) => {
					try {
						resolve(
							await earliestMatch.fn({
								...config,
								logObj: newLogObj,
								match: earliestMatch.match,
								matchText: earliestMatch.matchText,
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
											_cancel?.();
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
							})
						);
					} catch (e) {
						resolve({
							type: RESPONSE_TYPE.TEXT,
							text: 'Something went wrong',
						});
					}
				});
			};
			const response = await Promise.race([
				getResponse(),
				wait(1000 * 10).then(() =>
					Promise.resolve({
						type: RESPONSE_TYPE.TEXT,
						text: 'Action timed out',
					})
				),
			]);
			return {
				end: earliestMatch.end,
				response,
			};
		}

		matchConfig.fallback(config);

		return undefined;
	}

	public static createMatch(
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
					throw new Error(`Invalid type passed: ${String(innerArg)}`);
				}
			}
		}

		if (!matchData.fn) {
			throw new Error('No fn handler supplied');
		}

		return matchData as MatchData;
	}

	public static flatten<V>(arrays: V[][]): V[] {
		const flattened: V[] = [];

		for (const arr of arrays) {
			flattened.push(...arr);
		}

		return flattened;
	}

	public static splitAtWord(
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

	public static createJoinedWords(
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
	public static createMatchMaker(
		fn: (params: {
			matchMaker: MatchMaker;
			sameWordMaker: SameMaker;
			fallbackSetter: (fallback: MatchFallback) => void;
			conditional: (
				match: MatchData,
				condition: (params: MatchParams) => boolean
			) => void;
		}) => unknown
	): MatchConfig {
		const config: MatchConfig = {
			matches: [],
			fallback: () => {},
		};

		fn({
			matchMaker: (...args: (string[] | RegExp[] | MatchHandler)[]) => {
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

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public static resetState(_state: ChatState): void {}
}

export abstract class BotStateBase extends Matchable {
	public abstract toJSON(): unknown;
}
