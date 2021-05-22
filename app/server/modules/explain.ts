import { errorHandle, requireParams, auth } from '../lib/decorators';
import {
	attachMessage,
	LogCapturer,
	addLogListener,
	attachSourcedMessage,
	ResponseLike,
} from '../lib/logger';
import { AllModules, ModuleConfig } from './modules';
import { BotState } from '../lib/bot-state';
import { Bot as _Bot } from './bot';
import { ModuleMeta } from './meta';
import { Auth } from './auth';
import { Cast } from './cast';
import { createExternalClass } from '../lib/external';
import { createRouter } from '../lib/api';

export type ExplainHook = (
	description: string,
	source: string,
	logObj: any
) => void;

const ACTION_TIMEOUT_TIME = 30 * 60 * 1000;

export namespace Explain {
	export const meta = new (class Meta extends ModuleMeta {
		name = 'explain';

		async init(config: ModuleConfig) {
			await Routing.init({ ...config });
		}

		async notifyModules(modules: AllModules) {
			Explaining.initHooks(modules);
		}

		get external() {
			return External;
		}

		get bot() {
			return Bot;
		}
	})();

	export namespace API {
		export class Handler {
			private static _castActions(
				logObj: any,
				descr: string,
				actions: Explaining.Action[]
			) {
				new Cast.External.Handler(logObj, 'EXPLAIN.API').say(
					`${descr}. ${actions.map((action) => {
						return `At ${new Date(
							action.timestamp
						).toLocaleTimeString()}, source ${
							action.source
						} and module ${action.moduleName}. Description: ${
							action.description
						}`;
					})}`
				);
			}

			@errorHandle
			@requireParams('amount')
			@auth
			public static async getLastX(
				res: ResponseLike,
				{
					amount,
					announce = false,
				}: {
					amount: number;
					announce?: boolean;
					auth?: string;
				},
				source: string
			) {
				const actions = Explaining.getLastX(amount);
				const msg = attachSourcedMessage(
					res,
					source,
					await meta.explainHook,
					`Showing last ${amount} actions`,
					JSON.stringify(actions)
				);

				if (announce) {
					this._castActions(
						msg,
						`Last ${amount} actions are`,
						actions
					);
				}

				return actions;
			}

			@errorHandle
			@requireParams('mins')
			@auth
			public static async getLastXMins(
				res: ResponseLike,
				{
					mins,
					announce = false,
				}: {
					mins: number;
					announce?: boolean;
					auth?: string;
				},
				source: string
			) {
				const actions = Explaining.getInTimeWindow(mins);
				const msg = attachSourcedMessage(
					res,
					source,
					await meta.explainHook,
					`Showing last ${mins}ms of actions`,
					JSON.stringify(actions)
				);

				if (announce) {
					this._castActions(
						msg,
						`Last ${mins}ms of actions are`,
						actions
					);
				}

				return actions;
			}
		}
	}

	export namespace External {
		export class Handler extends createExternalClass(false) {
			requiresInit = false;

			explainTime(
				mins: number,
				announce: boolean = false
			): Promise<Explaining.Action[]> {
				return this.runRequest((res, source) => {
					return API.Handler.getLastXMins(
						res,
						{
							mins,
							announce: announce,
							auth: Auth.Secret.getKey(),
						},
						source
					);
				});
			}

			explainAmount(
				amount: number,
				announce: boolean = false
			): Promise<Explaining.Action[]> {
				return this.runRequest((res, source) => {
					return API.Handler.getLastX(
						res,
						{
							amount,
							announce: announce,
							auth: Auth.Secret.getKey(),
						},
						source
					);
				});
			}
		}
	}

	export namespace Bot {
		export interface JSON {
			lastSubjects: string[] | null;
		}

		export class Bot extends BotState.Base {
			static readonly commands = {
				'/explain': 'Explain actions in last 5 minutes',
				'/explainv':
					'Explain actions in last 5 minutes with additional logs',
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
								match.length && match[1]
									? parseInt(match[1], 10)
									: 5;
							const actions = Explaining.getInTimeWindow(
								1000 * 60 * minutes
							);

							attachMessage(
								logObj,
								`Showing verbose last ${minutes} minutes of actions`,
								JSON.stringify(actions)
							);

							return (
								await Promise.all(
									actions.map(async (action) => {
										const logs = await (async () => {
											if (!action.logs) return 'null';
											const lines =
												await action.logs.get();
											return lines;
										})();
										return `Time: ${new Date(
											action.timestamp
										).toLocaleTimeString()}\nModule: ${
											action.moduleName
										}\nSource: ${
											action.source
										}\nDescription: ${
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
						async ({ match, logObj }) => {
							const minutes =
								match.length && match[1]
									? parseInt(match[1], 10)
									: 5;
							const actions = Explaining.getInTimeWindow(
								1000 * 60 * minutes
							);

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
					mm(
						'/help_explain',
						/what commands are there for explain/,
						async () => {
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

			static resetState(state: _Bot.Message.StateKeeping.ChatState) {
				state.states.keyval.lastSubjects = null;
			}

			toJSON(): JSON {
				return {
					lastSubjects: this.lastSubjects,
				};
			}
		}
	}

	namespace Explaining {
		export interface Action {
			moduleName: string;
			description: string;
			source: string;
			logs: LogCapturer | null;
			timestamp: number;
		}

		const hooks: Set<Action> = new Set();

		function hook(
			moduleName: string,
			description: string,
			source: string,
			logObj: any
		) {
			if (moduleName === meta.name) return;

			const action: Action = {
				moduleName,
				description,
				source,
				logs: null,
				timestamp: Date.now(),
			};
			addLogListener(logObj, (captured) => {
				action.logs = captured;
			});
			hooks.add(action);
			setTimeout(() => {
				hooks.delete(action);
			}, ACTION_TIMEOUT_TIME);
		}

		export function initHooks(modules: AllModules) {
			for (const moduleName in modules) {
				const moduleObj = modules[moduleName as keyof AllModules];
				moduleObj.meta.addExplainHookFromExternal(
					(description, source, logObj) => {
						hook(moduleName, description, source, logObj);
					}
				);
			}
		}

		function sortChronological(actions: Action[]) {
			return actions.sort((a, b) => {
				return a.timestamp - b.timestamp;
			});
		}

		export function getInTimeWindow(ms: number): Action[] {
			const now = Date.now();
			const minTime = now - ms;

			const values = Array.from(hooks.values()).reverse();

			const retVals: Action[] = [];
			for (let i = 0; i < values.length; i++) {
				const action = values[i];
				if (action.timestamp < minTime) {
					break;
				}
				retVals.push(action);
			}

			return sortChronological(retVals);
		}

		export function getLastX(amount: number = 1): Action[] {
			return Array.from(hooks.values()).slice(-amount);
		}
	}

	export namespace Routing {
		export async function init({ app }: ModuleConfig) {
			const router = createRouter(Explain, API.Handler);
			router.post('/time/:mins', 'getLastXMins');
			router.post('/amount/:amount', 'getLastX');
			router.use(app);
		}
	}
}
