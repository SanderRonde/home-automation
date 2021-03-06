import { attachMessage, logOutgoingReq, logFirst } from '../lib/logger';
import { ModuleConfig, AllModules, InstanceOf } from './modules';
import { TELEGRAM_IPS, TELEGRAM_API } from '../lib/constants';
import { awaitCondition } from '../lib/util';
import { BotState } from '../lib/bot-state';
import { ResponseLike } from './multi';
import { Database } from '../lib/db';
import { log } from '../lib/logger';
import { ModuleMeta } from './meta';
import * as express from 'express';
import { getEnv } from '../lib/io';
import * as https from 'https';
import chalk from 'chalk';

const BOT_NAME = 'HuisBot';

export const enum RESPONSE_TYPE {
	MARKDOWN = 'Markdown',
	HTML = 'HTML',
	TEXT = 'Text'
}

export namespace Bot {
	let _modules!: AllModules;
	export const meta = new (class Meta extends ModuleMeta {
		name = 'bot';

		async init(config: ModuleConfig) {
			await Routing.init(config);
			await External.Handler.init();
		}

		async notifyModules(modules: AllModules) {
			_modules = modules;
		}

		get external() {
			return External;
		}
	})();

	async function getAllModules() {
		await awaitCondition(() => !!_modules, 100);
		return _modules;
	}

	export interface TelegramText {
		text: string;
	}

	export interface TelegramImage {
		photo: {
			file_id: string;
			file_size: number;
			width: number;
			height: number;
		}[];
	}

	export interface TelegramVoice {
		voice: {
			duration: number;
			mime_type: string;
			file_id: string;
			file_size: number;
		};
	}

	export interface TelegramDocument {
		document: {
			file_name: string;
			mime_type: string;
			file_id: string;
			file_size: number;
		};
	}

	export type TelegramReply<
		C = TelegramText | TelegramImage | TelegramVoice | TelegramDocument
	> = {
		reply_to_message: TelegramMessage<C>;
	} & TelegramText;

	export type TelegramMessage<
		C =
			| TelegramReply
			| TelegramText
			| TelegramImage
			| TelegramVoice
			| TelegramDocument
	> = {
		message_id: number;
		from: {
			id: number;
			is_bot: boolean;
			first_name: string;
			last_name: string;
			language_code: string;
		};
		chat: {
			id: number;
			first_name: string;
			last_name: string;
			type: 'private';
		};
		date: number;
	} & C;

	interface TelegramReqBody {
		message: TelegramMessage;
		edited_message: TelegramMessage;
	}

	interface TelegramReq extends express.Request {
		body: TelegramReqBody;
	}

	export namespace Message {
		export interface MatchResponse {
			end: number;
			response:
				| string
				| number
				| {
						type: RESPONSE_TYPE;
						text: string | number;
				  };
		}

		export namespace StateKeeping {
			export class ChatState {
				states!: {
					[K in keyof AllModules]: InstanceOf<
						AllModules[K]['meta']['bot']['Bot']
					>;
				};

				async init(
					json: {
						[K in keyof AllModules]: any;
					} = {} as any
				) {
					this.states = {} as any;

					const modules = await getAllModules();
					Object.keys(modules).map((key: keyof AllModules) => {
						const bot = modules[key].meta.bot.Bot;
						this.states[key] = new bot(json[key] || {}) as any;
					});
					return this;
				}

				async toJSON() {
					const obj: Partial<
						{
							[K in keyof AllModules]: any;
						}
					> = {};

					const modules = await getAllModules();
					Object.keys(modules).forEach((key: keyof AllModules) => {
						obj[key] = this.states[key].toJSON();
					});

					return obj;
				}
			}

			export class StateKeeper {
				chatIds: Map<number, ChatState> = new Map();

				constructor(private _db: Database) {}

				async init() {
					await this._restoreFromDB();
					return this;
				}

				private async _restoreFromDB() {
					const data = await this._db.data();
					for (const requestId in data) {
						this.chatIds.set(
							parseInt(requestId, 10),
							await new ChatState().init(data[requestId])
						);
					}
				}

				private async _saveChat(chatId: number) {
					await this._db.setVal(
						chatId + '',
						JSON.stringify(this.chatIds.get(chatId)!)
					);
				}

				async getState(chatId: number) {
					if (!this.chatIds.has(chatId)) {
						this.chatIds.set(chatId, await new ChatState().init());
					}
					return this.chatIds.get(chatId)!;
				}

				updateState(chatId: number) {
					this._saveChat(chatId);
				}
			}
		}

		export interface MatchParameters {
			logObj: any;
			text: string;
			message: Bot.TelegramMessage;
			state: Bot.Message.StateKeeping.ChatState;
			bot: Bot.Message.Handler;
			res: ResWrapper;
		}

		export class ResWrapper {
			public sent: boolean = false;

			constructor(public res: ResponseLike) {}
		}

		export class Handler extends BotState.Matchable {
			private static _bootedAt = new Date();
			private _stateKeeper!: StateKeeping.StateKeeper;

			static readonly matches = Handler.createMatchMaker(
				({ matchMaker: mm, sameWordMaker: wm }) => {
					mm('hi', 'hello', () => 'Hi!');
					mm('thanks', () => "You're welcome");
					mm('who am i', 'what is my name', ({ message }) => {
						return `You are ${message.chat.first_name} ${message.chat.last_name}.`;
					});
					mm('what is the chat id', ({ message }) => {
						return message.chat.id + '';
					});
					mm('who are you', 'what is your name', () => {
						return `I am ${BOT_NAME}`;
					});
					mm('What time is it', 'How late is it', () => {
						return new Date().toLocaleTimeString();
					});
					mm('what day is it', () => {
						const weekdays = [
							'monday',
							'tuesday',
							'wednesday',
							'thursday',
							'friday',
							'saturday',
							'sunday'
						];
						const day = new Date().getDay();
						return weekdays[day - 1];
					});
					mm(wm`What${["'s", ' is']} the date`, () => {
						return new Date().toLocaleDateString();
					});
					mm(wm`when did the server ${['boot', 'start']}`, () => {
						return Handler._bootedAt.toLocaleTimeString();
					});
					mm(
						'how long is the server up',
						'how long are you up',
						() => {
							const boot = Handler._bootedAt.getTime();
							const now = Date.now();
							let ms = now - boot;
							let seconds = Math.floor(ms / 1000);
							ms = ms % 1000;
							let mins = Math.floor(seconds / 60);
							seconds = seconds % 60;
							let hours = Math.floor(mins / 60);
							mins = mins % 60;
							let days = Math.floor(hours / 24);
							hours = hours % 24;

							return `${days} days, ${hours} hours, ${mins} mins, ${days} days, ${mins} mins, ${seconds} seconds and ${ms} milliseconds`;
						}
					);
				}
			);

			constructor(private _secret: string, private _db: Database) {
				super();
			}

			async init() {
				this._stateKeeper = await new StateKeeping.StateKeeper(
					this._db
				).init();
				return this;
			}

			async sendMessage(
				text: string,
				type: RESPONSE_TYPE,
				chatId?: number
			) {
				if (!this._lastChatID && !chatId) {
					log(
						`Did not send message ${text} because no last chat ID is known`
					);
					return Promise.resolve(false);
				}
				chatId = chatId || this._lastChatID;
				return new Promise<boolean>(resolve => {
					const msg = JSON.stringify({
						...{
							chat_id: chatId,
							text: text + ''
						},
						...(type === RESPONSE_TYPE.TEXT
							? {}
							: {
									parse_mode: type
							  })
					});
					const req = https.request({
						method: 'POST',
						path: `/bot${this._secret}/sendMessage`,
						hostname: TELEGRAM_API,
						headers: {
							'Content-Type': 'application/json'
						}
					});
					req.write(msg);
					req.on('error', e => {
						attachMessage(
							req,
							chalk.red('Error sending telegram msg'),
							e.toString()
						);
						resolve(false);
					});
					req.on('finish', () => {
						resolve(true);
						logOutgoingReq(req, {
							method: 'POST',
							target: TELEGRAM_API + '/sendMessage'
						});
					});
					req.end();

					const botLogObj = attachMessage(req, chalk.cyan('[bot]'));
					attachMessage(botLogObj, 'ID: ', chalk.bold(chatId + ''));
					attachMessage(botLogObj, 'Type: ', chalk.bold(type + ''));
					attachMessage(
						botLogObj,
						'Text: ',
						chalk.bold(JSON.stringify(text))
					);
				});
			}

			private static async _matchSelf(
				config: MatchParameters
			): Promise<MatchResponse | undefined> {
				return await BotState.Matchable.matchLines({
					...config,
					matchConfig: Handler.matches
				});
			}

			private static async _matchMatchables(
				config: MatchParameters,
				value: any,
				...matchables: typeof BotState.Matchable[]
			) {
				for (let i = 0; i < matchables.length; i++) {
					if (!value) {
						value = await matchables[i].match(config);
					} else {
						matchables[i].resetState(config.state);
					}
				}
				return value;
			}

			static async match(
				config: MatchParameters
			): Promise<MatchResponse | undefined> {
				return this._matchMatchables(
					config,
					await this._matchSelf(config),
					...Object.values(await getAllModules()).map(
						mod => mod.meta.bot.Bot
					)
				);
			}

			static async multiMatch({
				logObj,
				text,
				message,
				state,
				res,
				bot
			}: MatchParameters): Promise<
				| {
						type: RESPONSE_TYPE;
						text: string | number;
				  }[]
				| undefined
			> {
				let response: {
					type: RESPONSE_TYPE;
					text: string | number;
				}[] = [];

				let match: MatchResponse | undefined = undefined;

				while (
					(match = await this.match({
						logObj,
						text,
						message,
						state,
						res,
						bot
					}))
				) {
					// Push response
					if (
						typeof match.response === 'string' ||
						typeof match.response === 'number'
					) {
						response.push({
							type: RESPONSE_TYPE.TEXT,
							text: match.response
						});
					} else {
						response.push(match.response);
					}

					// Adapt the text
					text = text.slice(match.end).trim();

					if (text.startsWith('and')) {
						text = text.slice('and'.length).trim();
					} else if (text.startsWith(',') || text.startsWith('.')) {
						text = text.slice(','.length).trim();
					} else {
						// Stop, no more joining text
						break;
					}
				}

				if (response.length === 0) return undefined;

				const responses: {
					type: RESPONSE_TYPE;
					text: string | number;
				}[] = [response[0]];
				let lastType: string = response[0].type;
				for (let i = 1; i < response.length; i++) {
					if (lastType !== response[i].type) {
						responses.push(response[i]);
					} else {
						responses[responses.length - 1].text +=
							'\n' + response[i].text;
					}
				}
				return responses;
			}

			async handleTextMessage(
				logObj: any,
				message: TelegramMessage<TelegramText>,
				res: ResWrapper
			) {
				attachMessage(
					logObj,
					`Message text:`,
					chalk.bold(message.text)
				);
				attachMessage(
					logObj,
					`Chat ID:`,
					chalk.bold(message.chat.id + '')
				);
				const matchMsg = attachMessage(logObj, 'Match');
				return (
					(await Handler.multiMatch({
						logObj: matchMsg,
						text: message.text,
						message,
						state: await this._stateKeeper.getState(
							message.chat.id
						),
						res,
						bot: this
					})) ||
					(attachMessage(matchMsg, 'None') && [
						{
							type: RESPONSE_TYPE.TEXT,
							text: "I'm not sure what you mean"
						}
					])
				);
			}

			async handleReplyMessage(
				logObj: any,
				message: TelegramMessage<TelegramReply>,
				res: ResWrapper
			): Promise<
				{
					type: RESPONSE_TYPE;
					text: string | number;
				}[]
			> {
				attachMessage(
					logObj,
					`Reply message text:`,
					chalk.bold(message.text)
				);
				attachMessage(
					logObj,
					`Reply chat ID:`,
					chalk.bold(message.chat.id + '')
				);
				const replyObj = attachMessage(logObj, 'Reply');
				if ('text' in message.reply_to_message) {
					return this.handleTextMessage(
						replyObj,
						message.reply_to_message,
						res
					);
				}
				if ('reply_to_message' in message) {
					return this.handleReplyMessage(
						replyObj,
						((message as unknown) as TelegramMessage<
							TelegramReply<TelegramReply>
						>).reply_to_message,
						res
					);
				}
				return [
					{
						type: RESPONSE_TYPE.TEXT,
						text: 'Message type unsupported' as string | number
					}
				];
			}

			private _splitLongText(text: string) {
				if (text.length <= 4096) return [text];
				const parts = [];
				while (text.length >= 4096) {
					parts.push(text.slice(0, 4096));
					text = text.slice(4096);
				}
				return parts;
			}

			private _finishRes(wrapped: ResWrapper) {
				if (wrapped.sent) return;
				wrapped.res.write('ok');
				wrapped.res.end();
				wrapped.sent = true;
			}

			private _openQuestions: ((response: string) => void)[] = [];
			async askQuestion(
				question: string,
				message: TelegramMessage,
				res: ResWrapper
			) {
				// Send early
				this._finishRes(res);

				const chatId = message?.chat.id;
				if (chatId === undefined) return undefined;
				this._lastChatID = chatId;

				if (
					!(await this.sendMessage(
						question,
						RESPONSE_TYPE.TEXT,
						chatId
					))
				) {
					return undefined;
				}

				return new Promise<string>(resolve => {
					this._openQuestions.push(resolve);
				});
			}

			async askCancelable(
				question: string,
				message: TelegramMessage,
				res: ResWrapper,
				setCancelable: (cancel: () => void) => void
			) {
				// Send early
				this._finishRes(res);

				const chatId = message?.chat.id;
				if (chatId === undefined) return undefined;
				this._lastChatID = chatId;

				if (
					!(await this.sendMessage(
						question,
						RESPONSE_TYPE.TEXT,
						chatId
					))
				) {
					return undefined;
				}

				return new Promise<string>(resolve => {
					this._openQuestions.push(resolve);
					setCancelable(() => {
						this._openQuestions.splice(
							this._openQuestions.indexOf(resolve),
							1
						);
					});
				});
			}

			async sendText(
				text: string,
				message: TelegramMessage,
				res: ResWrapper
			): Promise<boolean> {
				// Send early
				this._finishRes(res);

				const chatId = message?.chat.id;
				if (chatId === undefined) return false;
				this._lastChatID = chatId;

				return await this.sendMessage(text, RESPONSE_TYPE.TEXT, chatId);
			}

			isQuestion(message: TelegramMessage) {
				return this._openQuestions.length > 0 && 'text' in message;
			}

			handleQuestion(message: TelegramMessage<TelegramText>) {
				const firstQuestion = this._openQuestions.shift();
				firstQuestion!(message.text);
			}

			private _lastChatID: number = 0;
			async handleMessage(req: TelegramReq, res: ResponseLike) {
				const { message, edited_message } = req.body;
				const logObj = attachMessage(
					res,
					chalk.bold(chalk.cyan('[bot]'))
				);

				const resWrapped = new ResWrapper(res);
				const responses = await (() => {
					if (edited_message) {
						return [
							{
								type: RESPONSE_TYPE.TEXT,
								text: 'Edits unsupported'
							}
						];
					}
					if (this.isQuestion(message)) {
						this.handleQuestion(
							message as TelegramMessage<TelegramText>
						);
						return [];
					}
					if ('reply_to_message' in message) {
						return this.handleTextMessage(
							logObj,
							message,
							resWrapped
						);
					}
					if ('text' in message) {
						return this.handleTextMessage(
							logObj,
							message,
							resWrapped
						);
					}
					return [
						{
							type: RESPONSE_TYPE.TEXT,
							text: 'Message type unsupported' as string | number
						}
					];
				})();
				attachMessage(
					logObj,
					'Return value(s)',
					chalk.bold(JSON.stringify(responses))
				);
				const sendSuccesful = (
					await Promise.all(
						responses.map(async response => {
							const chatId =
								message?.chat.id || edited_message?.chat.id;
							if (chatId === undefined) return false;
							this._lastChatID = chatId;
							const textParts = this._splitLongText(
								response.text + ''
							);
							for (const textPart of textParts) {
								if (
									!(await this.sendMessage(
										textPart,
										response.type,
										chatId
									))
								) {
									return false;
								}
							}
							return true;
						})
					)
				).every(v => v);

				if (!resWrapped.sent) {
					if (sendSuccesful) {
						resWrapped.res.write('ok');
					} else {
						resWrapped.res.write('Error : failed to respond');
					}
					resWrapped.res.end();
				}
			}
		}
	}

	export namespace External {
		type ExternalRequest = {
			type: 'sendMessage';
			text: string;
			msgType: RESPONSE_TYPE;
			chatID?: number;
		} & {
			logObj: any;
			resolver: (result: boolean) => void;
			source: string;
		};

		export class Handler {
			private static _requests: ExternalRequest[] = [];

			private static _ready: boolean = false;
			static async init() {
				this._ready = true;
				for (const req of this._requests) {
					await this._handleRequest(req);
				}
			}

			constructor(private _logObj: any, private _source: string) {}

			private static async _handleRequest(request: ExternalRequest) {
				const { resolver } = request;
				if (request.type === 'sendMessage') {
					const result = await Routing.handler!.sendMessage(
						request.text,
						request.msgType,
						request.chatID
					);
					resolver(result);
				}
			}

			async sendMessage(
				text: string,
				type: RESPONSE_TYPE,
				chatID?: number
			): Promise<boolean> {
				return new Promise<boolean>(resolve => {
					const req: ExternalRequest = {
						type: 'sendMessage',
						text,
						msgType: type,
						chatID,
						logObj: this._logObj,
						resolver: resolve,
						source: this._source
					};
					if (Handler._ready) {
						Handler._handleRequest(req);
					} else {
						Handler._requests.push(req);
					}
				});
			}
		}
	}

	export namespace Routing {
		function isInIPRange(
			ip: number[],
			range: {
				start: number[];
				lower: number[];
				upper: number[];
			}
		) {
			let blockIndex = 0;
			for (let i = 0; i < range.start.length; i++, blockIndex++) {
				if (ip[blockIndex] !== range.start[i]) return false;
			}

			return (
				ip[blockIndex] >= range.lower[0] &&
				ip[blockIndex] <= range.upper[0]
			);
		}

		function isFromTelegram(req: TelegramReq) {
			const fwd = req.headers['x-forwarded-for'] as string;
			const [ipv4] = fwd.split(',');
			const ipBlocks = ipv4.split('.').map(p => parseInt(p));
			return TELEGRAM_IPS.some(r => isInIPRange(ipBlocks, r));
		}

		export let handler: Message.Handler | null = null;
		export async function init({ app, db }: ModuleConfig) {
			const secret = getEnv('SECRET_BOT', true);
			handler = await new Message.Handler(secret, db).init();

			app.post('/bot/msg', async (req, res) => {
				if (isFromTelegram(req)) {
					await handler!.handleMessage(req, res);
				} else {
					res.write('Error: auth problem');
					res.end();
				}
			});
		}
	}

	export async function printCommands() {
		logFirst(
			`${chalk.bold('Available commands are')}:\n\n${Object.values(
				await getAllModules()
			)
				.map(mod => mod.meta.bot.Bot)
				.map(bot => {
					return `${Object.keys(bot.commands)
						.map(cmd => {
							return `${chalk.bold(cmd.slice(1))} - ${
								bot.commands[cmd as keyof typeof bot.commands]
							}`;
						})
						.join('\n')}`;
				})
				.join('\n')}\n`
		);
	}
}
