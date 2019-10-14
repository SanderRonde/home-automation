import { BOT_SECRET_FILE, TELEGRAM_IPS, TELEGRAM_API } from "../lib/constants";
import { attachMessage, logOutgoingReq } from "../lib/logger";
import { HomeDetector } from "./home-detector";
import { BotState } from '../lib/bot-state';
import { AppWrapper } from "../lib/routes";
import { ResponseLike } from "./multi";
import { Database } from "../lib/db";
import * as express from 'express';
import { KeyVal } from "./keyval";
import { Script } from "./script";
import * as fs from 'fs-extra';
import * as https from 'https';
import { RGB } from "./rgb";
import chalk from 'chalk';

const BOT_NAME = 'HuisBot';

export namespace Bot {
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

	export type TelegramMessage<C = TelegramText|TelegramImage> = {
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
		message: TelegramMessage
	}

	interface TelegramReq extends express.Request {
		body: TelegramReqBody;
	}

	export namespace Message {
		export interface MatchResponse {
			end: number;
			response: string;
		}

		export namespace StateKeeping {
			export class ChatState {
				rgb!: RGB.Bot.State;
				keyval!: KeyVal.Bot.State;
				script!: Script.Bot.State;
				homeDetector!: HomeDetector.Bot.State;

				constructor(json: {
					rgb?: RGB.Bot.JSON;
					keyval?: KeyVal.Bot.JSON;
					script?: Script.Bot.JSON;
					homeDetector?: HomeDetector.Bot.JSON;
				} = {}) {
					this.rgb = new RGB.Bot.State(json.rgb);
					this.keyval = new KeyVal.Bot.State(json.keyval);
					this.script = new Script.Bot.State(json.script);
					this.homeDetector = new HomeDetector.Bot.State(json.homeDetector);
				}

				toJSON() {
					return {
						rgb: this.rgb.toJSON(),
						keyval: this.keyval.toJSON(),
						script: this.script.toJSON(),
						homeDetector: this.homeDetector.toJSON()
					}
				}
			}

			export class StateKeeper {
				chatIds: Map<number, ChatState> = new Map();

				constructor(private _db: Database) { }

				async init() {
					await this._restoreFromDB();
					return this;
				}

				private async _restoreFromDB() {
					const data = await this._db.data();
					for (const requestId in data) {
						this.chatIds.set(parseInt(requestId, 10),
							new ChatState(data[requestId]));
					}
				}

				private async _saveChat(chatId: number) {
					await this._db.setVal(chatId + '', JSON.stringify(this.chatIds.get(chatId)!));
				}

				getState(chatId: number) {
					if (!this.chatIds.has(chatId)) {
						this.chatIds.set(chatId, new ChatState());
					}
					return this.chatIds.get(chatId)!
				}

				updateState(chatId: number) {
					this._saveChat(chatId);
				}
			}
		}

		export class Handler extends BotState.Matchable {
			private static _bootedAt = new Date();
			private _stateKeeper!: StateKeeping.StateKeeper;

			static readonly matches = Handler.createMatchMaker(({ 
				matchMaker: mm,
				sameWordMaker: wm
			}) => {
				mm('hi', 'hello', () => 'Hi!');
				mm('thanks', () => 'You\'re welcome');
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
				})
				mm('what day is it', () => {
					const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
					const day = new Date().getDay();
					return weekdays[day - 1];
				});
				mm(wm`What${['\'s', ' is']} the date`, () => {
					return new Date().toLocaleDateString();
				});
				mm(wm`when did the server ${['boot', 'start']}`, () => {
					return Handler._bootedAt.toLocaleTimeString();
				});
				mm('how long is the server up', 'how long are you up', () => {
					const boot = Handler._bootedAt.getTime()
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

					return `${days} days, ${hours} hours, ${mins} mins, ${days} days, ${
						mins} mins, ${seconds} seconds and ${ms} milliseconds`;
				});
			});

			constructor(private _secret: string, private _db: Database) {
				super();
			}

			async init() {
				this._stateKeeper = await new StateKeeping.StateKeeper(this._db);
				return this;
			}

			async sendMessage(text: string, chatId: number) {
				return new Promise<boolean>((resolve) => {
					const msg = JSON.stringify({
						chat_id: chatId,
						text
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
					req.on('error', (e) => {
						attachMessage(req, chalk.red('Error sending telegram msg'), e.toString());
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

					attachMessage(req, chalk.cyan('[bot]'), 'id: ', chalk.bold(chatId + ''),
						'Text: ', chalk.bold(text));
				});
			}

			private static async _matchSelf(config: { 
				logObj: any; 
				text: string; 
				message: Bot.TelegramMessage; 
				state: Bot.Message.StateKeeping.ChatState; 
			}): Promise<MatchResponse | undefined> {
				return await BotState.Matchable.matchLines({ ...config, matchConfig: Handler.matches });
			}

			private static async _matchMatchables(config: { 
				logObj: any; 
				text: string; 
				message: Bot.TelegramMessage; 
				state: Bot.Message.StateKeeping.ChatState; 
			}, value: any, ...matchables: (typeof BotState.Matchable)[]) {
				for (let i = 0; i < matchables.length; i++) {
					if (!value) {
						value = await matchables[i].match(config);
					} else {
						matchables[i].resetState(config.state);
					}
				}
				return value;
			}

			static async match(config: { 
				logObj: any; 
				text: string; 
				message: Bot.TelegramMessage; 
				state: Bot.Message.StateKeeping.ChatState; 
			}): Promise<MatchResponse | undefined> {
				return this._matchMatchables(config,
					await this._matchSelf(config),
					KeyVal.Bot.State,
					RGB.Bot.State);
			}

			static async multiMatch({ logObj, text, message, state }: { 
				logObj: any; 
				text: string; 
				message: Bot.TelegramMessage; 
				state: Bot.Message.StateKeeping.ChatState; 
			}): Promise<string | undefined> {
				let response: string[] = [];

				let match: MatchResponse | undefined = undefined;
				
				while ((match = await this.match({
					logObj, text, message, state
				}))) {
					// Push response
					response.push(match.response);

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
				return response.join('\n');
			}

			async handleTextMessage(logObj: any, message: TelegramMessage<TelegramText>) {
				attachMessage(logObj, `Message text:`, chalk.bold(message.text));
				attachMessage(logObj, `Chat ID:`, chalk.bold(message.chat.id + ''));
				const matchMsg = attachMessage(logObj, chalk.bold('Match'));
				return await Handler.multiMatch({
					logObj: matchMsg,
					text: message.text, 
					message,
					state: this._stateKeeper.getState(message.chat.id)
				}) || (attachMessage(matchMsg, 'None') && 'I\'m not sure what you mean');
			}

			async handleMessage(req: TelegramReq, res: ResponseLike) {
				const { message } = req.body;
				const logObj = attachMessage(res, chalk.bold(chalk.cyan('[bot]')));
			
				const response = await (() => {
					if ('text' in message) {
						return this.handleTextMessage(logObj,
							message);
					}
					return 'Message type unsupported';
				})();
				if (await this.sendMessage(response, message.chat.id)) {
					res.write('ok');
				} else {
					res.write('Error : failed to respond');
				}
				res.end();
			}
		}
	}

	export namespace Routing {
		function isInIPRange(ip: number[], range: {
			start: number[];
			lower: number[];
			upper: number[];
		}) {
			let blockIndex = 0;
			for (let i = 0; i < range.start.length; i++ , blockIndex++) {
				if (ip[blockIndex] !== range.start[i]) return false;
			}

			return ip[blockIndex] >= range.lower[0] && ip[blockIndex] <= range.upper[0];
		}

		function isFromTelegram(req: TelegramReq) {
			const fwd = req.headers['x-forwarded-for'] as string;
			const [ipv4] = fwd.split(',');
			const ipBlocks = ipv4.split('.').map(p => parseInt(p));
			return TELEGRAM_IPS.some(r => isInIPRange(ipBlocks, r));
		}

		export async function init({
			app, db
		}: {
			app: AppWrapper;
			db: Database;
		}) {
			const secret = await fs.readFile(BOT_SECRET_FILE, {
				encoding: 'utf8'
			});
			const handler = await new Message.Handler(secret, db).init();

			app.post('/bot/msg', async (req, res) => {
				if (isFromTelegram(req)) {
					await handler.handleMessage(req, res);
				} else {
					res.write('Error: auth problem');
					res.end();
				}
			});
		}
	}
}