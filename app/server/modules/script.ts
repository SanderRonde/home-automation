import { errorHandle, requireParams, auth } from "../lib/decorators";
import * as childProcess from 'child_process';
import { attachMessage, ResDummy } from "../lib/logger";
import { BotState } from '../lib/bot-state';
import { AppWrapper } from "../lib/routes";
import { AuthError } from "../lib/errors";
import { ResponseLike } from "./multi";
import { Bot as _Bot } from './bot';
import { Auth } from "../lib/auth";
import { Config } from "../app";
import * as path from 'path';
import chalk from 'chalk';

export namespace Script {
	export namespace External {
		interface ExternalRequest {
			type: 'script';
			name: string;
			logObj: any;
			resolver: (value: any) => void;
		}

		export class Handler {
			private static _config: Config|null = null;
			private static _requests: ExternalRequest[] = [];

			constructor(private _logObj: any) {}

			static async init({ config }: { config: Config }) {
				this._config = config;
				for (const req of this._requests) {
					await this._handleRequest(req);
				}
			}

			private static async _handleRequest(request: ExternalRequest) {
				const dummy = new ResDummy();
				const value = await API.Handler.script(dummy, {
					name: request.name,
					auth: await Auth.Secret.getKey()
				}, this._config!);
				dummy.transferTo(request.logObj);
				request.resolver(value);
			}

			async script(name: string) {
				return new Promise<any>((resolve) => {
					const req: ExternalRequest = {
						type: 'script',
						name,
						logObj: this._logObj,
						resolver: resolve
					};
					if (Handler._config) {
						Handler._handleRequest(req);
					} else {
						Handler._requests.push(req);
					}
				});
			}
		}
	}

	export namespace Bot {
		export interface JSON {

		}

		export class Bot extends BotState.Base {
			static readonly commands = {
				'/runscript': 'Run given script',
				'/killpc': 'Shut down pc',
				'/wakepc': 'Start pc',
				'/help_script': 'Print help comands for script'
			};

			static readonly botName = 'Script';

			static readonly matches = Bot.createMatchMaker(({
				matchMaker: mm
			}) => {
				mm('/runscript', /run script ([^ ]+)/, async ({
					logObj, match
				}) => {
					const script = match[1];
					const output = await new External.Handler(logObj).script(script);
					if (output) {
						return `Script output: ${output}`;
					} else {
						return 'Ran script, no output'
					}
				});
				mm('/killpc', /(shutdown|kill) desktop/, async ({
					logObj
				}) => {
					await new External.Handler(logObj).script('shutdown_desktop');
					return 'Shut it down';
				});
				mm('/wakepc', /(wake|start|boot) desktop/, async ({
					logObj
				}) => {
					await new External.Handler(logObj).script('wake_desktop');
					return 'Started it';
				});
				mm('/help_script', /what commands are there for script/, async () => {
					return `Commands are:\n${Bot.matches.matches.map((match) => {
						return `RegExps: ${
							match.regexps.map(r => r.source).join(', ')}. Texts: ${
								match.texts.join(', ')}}`
					}).join('\n')}`
				});
			});

			constructor(_json?: JSON) {
				super();	
			}

			static async match(config: { 
				logObj: any; 
				text: string; 
				message: _Bot.TelegramMessage; 
				state: _Bot.Message.StateKeeping.ChatState; 
			}): Promise<_Bot.Message.MatchResponse | undefined> {
				return await this.matchLines({ ...config, matchConfig: Bot.matches });
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
			@auth
			public static async script(res: ResponseLike, params: {
				auth?: string;
				name: string;
			}, config: Config) {
				if (params.name.indexOf('..') > -1 || params.name.indexOf('/') > -1) {
					throw new AuthError('Going up dirs is not allowed');
				}
				const scriptPath = path.join(config.scripts.scriptDir, params.name);
				attachMessage(res, `Script: "${scriptPath}"`);
				try {
					const output = childProcess.execFileSync(
						path.join(config.scripts.scriptDir, params.name), {
							uid: config.scripts.uid,
							gid: config.scripts.uid
						}).toString();
					attachMessage(res, `Output: "${output}"`);
					res.write(output);
					res.status(200);
					res.end();
					return output;
				} catch(e) {
					const errMsg = attachMessage(res, chalk.bgRed(chalk.black(`Error: ${e.message}`)));
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
			app, config 
		}: { 
			app: AppWrapper; 
			config: Config; 
		}) {
			app.post('/script/:name', async (req, res, _next) => {
				await API.Handler.script(res, {...req.params, ...req.body}, config);
			});
		}
	}
}