import { errorHandle, requireParams, authAll } from '../lib/decorators';
import { attachMessage, attachSourcedMessage } from '../lib/logger';
import * as childProcess from 'child_process';
import { BotState } from '../lib/bot-state';
import { AppWrapper } from '../lib/routes';
import { AuthError } from '../lib/errors';
import { ResponseLike } from './multi';
import { ModuleConfig } from './modules';
import { Bot as _Bot } from './bot';
import { Config } from '../app';
import { ModuleMeta } from './meta';
import { Auth } from './auth';
import * as path from 'path';
import chalk from 'chalk';
import { ExternalClass } from '../lib/external';

export namespace Script {
	export const meta = new (class Meta extends ModuleMeta {
		name = 'script';

		async init(config: ModuleConfig) {
			Routing.init(config);
		}

		get external() {
			return External;
		}

		get bot() {
			return Bot;
		}
	})();

	export namespace External {
		export class Handler extends ExternalClass {
			requiresInit = true;

			private static _config: Config | null = null;

			static async init({ config }: { config: Config }) {
				this._config = config;
				super.init();
			}

			async script(name: string) {
				return this.runRequest((res, source) => {
					return API.Handler.script(
						res,
						{
							name,
							auth: Auth.Secret.getKey()
						},
						Handler._config!,
						source
					);
				});
			}
		}
	}

	export namespace Bot {
		export interface JSON {}

		export class Bot extends BotState.Base {
			static readonly commands = {
				'/runscript': 'Run given script',
				'/killpc': 'Shut down pc',
				'/wakepc': 'Start pc',
				'/help_script': 'Print help comands for script'
			};

			static readonly botName = 'Script';

			static readonly matches = Bot.createMatchMaker(
				({ matchMaker: mm }) => {
					mm(
						'/runscript',
						/run script ([^ ]+)/,
						async ({ logObj, match }) => {
							const script = match[1];
							const output = await new External.Handler(
								logObj,
								'SCRIPT.BOT'
							).script(script);
							if (output) {
								return `Script output: ${output}`;
							} else {
								return 'Ran script, no output';
							}
						}
					);
					mm(
						'/killpc',
						/(shutdown|kill) desktop/,
						async ({ logObj }) => {
							await new External.Handler(
								logObj,
								'SCRIPT.BOT'
							).script('shutdown_desktop');
							return 'Shut it down';
						}
					);
					mm(
						'/wakepc',
						/(wake|start|boot) desktop/,
						async ({ logObj }) => {
							await new External.Handler(
								logObj,
								'SCRIPT.BOT'
							).script('wake_desktop');
							return 'Started it';
						}
					);
					mm(
						'/help_script',
						/what commands are there for script/,
						async () => {
							return `Commands are:\n${Bot.matches.matches
								.map(match => {
									return `RegExps: ${match.regexps
										.map(r => r.source)
										.join(', ')}. Texts: ${match.texts.join(
										', '
									)}}`;
								})
								.join('\n')}`;
						}
					);
				}
			);

			constructor(_json?: JSON) {
				super();
			}

			static async match(
				config: _Bot.Message.MatchParameters
			): Promise<_Bot.Message.MatchResponse | undefined> {
				return await this.matchLines({
					...config,
					matchConfig: Bot.matches
				});
			}

			toJSON(): JSON {
				return {};
			}
		}
	}

	export namespace API {
		export class Handler {
			@errorHandle
			@requireParams('auth', 'name')
			@authAll
			public static async script(
				res: ResponseLike,
				params: {
					auth?: string;
					name: string;
				},
				config: Config,
				source: string
			) {
				if (
					params.name.indexOf('..') > -1 ||
					params.name.indexOf('/') > -1
				) {
					throw new AuthError('Going up dirs is not allowed');
				}
				const scriptPath = path.join(
					config.scripts.scriptDir,
					params.name
				);
				attachSourcedMessage(
					res,
					source,
					await meta.explainHook,
					`Script: "${scriptPath}"`
				);
				try {
					const output = childProcess
						.execFileSync(
							path.join(config.scripts.scriptDir, params.name),
							{
								uid: config.scripts.uid,
								gid: config.scripts.uid
							}
						)
						.toString();
					attachMessage(res, `Output: "${output}"`);
					res.write(output);
					res.status(200);
					res.end();
					return output;
				} catch (e) {
					const errMsg = attachMessage(
						res,
						chalk.bgRed(chalk.black(`Error: ${e.message}`))
					);
					for (const line of e.stack.split('\n')) {
						attachMessage(errMsg, chalk.bgRed(chalk.black(line)));
					}
					res.status(400).end();
					return '';
				}
			}
		}
	}

	export namespace Routing {
		export function init({
			app,
			config
		}: {
			app: AppWrapper;
			config: Config;
		}) {
			app.post('/script/:name', async (req, res, _next) => {
				await API.Handler.script(
					res,
					{ ...req.params, ...req.body, cookies: req.cookies },
					config,
					`${Script.meta.name}.API.${req.url}`
				);
			});
		}
	}
}
