import {
	MatchResponse,
	RESPONSE_TYPE,
	TelegramMessage,
	TelegramReq,
	TelegramText,
} from '../types';
import {
	attachMessage,
	log,
	LogObj,
	logOutgoingReq,
	ResponseLike,
} from '../../../lib/logger';
import { BotStateBase, Matchable } from '../../../lib/bot-state';
import { ChatState, StateKeeper } from './state-keeping';
import { TELEGRAM_API } from '../../../lib/constants';
import { Database } from '../../../lib/db';
import { BOT_NAME } from '../constants';
import * as https from 'https';
import chalk from 'chalk';
import { Bot } from '..';

export interface MatchParameters {
	logObj: LogObj;
	text: string;
	message: TelegramMessage;
	state: ChatState;
	bot: MessageHandler;
	res: ResWrapper;
}

export class ResWrapper {
	public sent = false;

	public constructor(public res: ResponseLike) {}
}

export class MessageHandler extends BotStateBase {
	private static _bootedAt = new Date();

	public static readonly matches = MessageHandler.createMatchMaker(
		({ matchMaker: mm, sameWordMaker: wm }) => {
			mm('hi', 'hello', () => 'Hi!');
			mm('thanks', () => "You're welcome");
			mm('who am i', 'what is my name', ({ message }) => {
				return `You are ${message.chat.first_name} ${message.chat.last_name}.`;
			});
			mm('what is the chat id', ({ message }) => {
				return String(message.chat.id);
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
					'sunday',
				];
				const day = new Date().getDay();
				return weekdays[day - 1];
			});
			mm(wm`What${["'s", ' is']} the date`, () => {
				return new Date().toLocaleDateString();
			});
			mm(wm`when did the server ${['boot', 'start']}`, () => {
				return MessageHandler._bootedAt.toLocaleTimeString();
			});
			mm('how long is the server up', 'how long are you up', () => {
				const boot = MessageHandler._bootedAt.getTime();
				const now = Date.now();
				let ms = now - boot;
				let seconds = Math.floor(ms / 1000);
				ms = ms % 1000;
				let mins = Math.floor(seconds / 60);
				seconds = seconds % 60;
				let hours = Math.floor(mins / 60);
				mins = mins % 60;
				const days = Math.floor(hours / 24);
				hours = hours % 24;

				return `${days} days, ${hours} hours, ${mins} mins, ${days} days, ${mins} mins, ${seconds} seconds and ${ms} milliseconds`;
			});
		}
	);

	private _stateKeeper!: StateKeeper;
	private _openQuestions: ((response: string) => void)[] = [];
	private _lastChatID = 0;

	public constructor(
		private readonly _secret: string,
		private readonly _db: Database
	) {
		super();
	}

	private static async _matchSelf(
		config: MatchParameters
	): Promise<MatchResponse | undefined> {
		return await Matchable.matchLines({
			...config,
			matchConfig: MessageHandler.matches,
		});
	}

	private static async _matchMatchables<V>(
		config: MatchParameters,
		value: V,
		...matchables: (typeof Matchable)[]
	): Promise<V> {
		for (let i = 0; i < matchables.length; i++) {
			if (!value) {
				value = (await matchables[i].match(config)) as unknown as V;
			} else {
				matchables[i].resetState(config.state);
			}
		}
		return value;
	}

	public static async match(
		config: MatchParameters
	): Promise<MatchResponse | undefined> {
		return this._matchMatchables(
			config,
			await this._matchSelf(config),
			...Object.values(await Bot.modules).map((meta) => {
				return meta.Bot;
			})
		);
	}

	public static async multiMatch({
		logObj,
		text,
		message,
		state,
		res,
		bot,
	}: MatchParameters): Promise<
		| {
				type: RESPONSE_TYPE;
				text: string | number;
		  }[]
		| undefined
	> {
		const response: {
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
				bot,
			}))
		) {
			// Push response
			if (
				typeof match.response === 'string' ||
				typeof match.response === 'number'
			) {
				response.push({
					type: RESPONSE_TYPE.TEXT,
					text: match.response,
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

		if (response.length === 0) {
			return undefined;
		}

		const responses: {
			type: RESPONSE_TYPE;
			text: string | number;
		}[] = [response[0]];
		const lastType: RESPONSE_TYPE = response[0].type;
		for (let i = 1; i < response.length; i++) {
			if (lastType !== response[i].type) {
				responses.push(response[i]);
			} else {
				responses[responses.length - 1].text +=
					`'\n'${response[i].text}`;
			}
		}
		return responses;
	}

	private _splitLongText(text: string) {
		if (text.length <= 4096) {
			return [text];
		}
		const parts = [];
		while (text.length >= 4096) {
			parts.push(text.slice(0, 4096));
			text = text.slice(4096);
		}
		return parts;
	}

	private _finishRes(wrapped: ResWrapper) {
		if (wrapped.sent) {
			return;
		}
		wrapped.res.write('ok');
		wrapped.res.end();
		wrapped.sent = true;
	}

	public async init(): Promise<this> {
		this._stateKeeper = await new StateKeeper(this._db).init();
		return this;
	}

	public async sendMessage(
		text: string,
		type: RESPONSE_TYPE,
		chatId?: number
	): Promise<boolean> {
		if (!this._lastChatID && !chatId) {
			log(
				`Did not send message ${text} because no last chat ID is known`
			);
			return Promise.resolve(false);
		}
		chatId = chatId || this._lastChatID;
		return new Promise<boolean>((resolve) => {
			const msg = JSON.stringify({
				...{
					chat_id: chatId,
					text: text + '',
				},
				...(type === RESPONSE_TYPE.TEXT
					? {}
					: {
							parse_mode: type,
						}),
			});
			const req = https.request({
				method: 'POST',
				path: `/bot${this._secret}/sendMessage`,
				hostname: TELEGRAM_API,
				headers: {
					'Content-Type': 'application/json',
				},
			});
			req.write(msg);
			req.on('error', (e) => {
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
					target: TELEGRAM_API + '/sendMessage',
				});
			});
			req.end();

			const botLogObj = attachMessage(req, chalk.cyan('[bot]'));
			attachMessage(botLogObj, 'ID: ', chalk.bold(String(chatId)));
			attachMessage(botLogObj, 'Type: ', chalk.bold(String(type)));
			attachMessage(
				botLogObj,
				'Text: ',
				chalk.bold(JSON.stringify(text))
			);
		});
	}

	public async handleTextMessage(
		logObj: LogObj,
		message: TelegramMessage<TelegramText>,
		res: ResWrapper
	): Promise<
		{
			type: RESPONSE_TYPE;
			text: string | number;
		}[]
	> {
		attachMessage(logObj, 'Message text:', chalk.bold(message.text));
		attachMessage(logObj, 'Chat ID:', chalk.bold(String(message.chat.id)));
		const matchMsg = attachMessage(logObj, 'Match');
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return (
			(await MessageHandler.multiMatch({
				logObj: matchMsg,
				text: message.text,
				message,
				state: this._stateKeeper.getState(message.chat.id),
				res,
				bot: this,
			})) ||
			(attachMessage(matchMsg, 'None') && [
				{
					type: RESPONSE_TYPE.TEXT,
					text: "I'm not sure what you mean",
				},
			])
		);
	}

	public async askQuestion(
		question: string,
		message: TelegramMessage,
		res: ResWrapper
	): Promise<string | undefined> {
		// Send early
		this._finishRes(res);

		const chatId = message?.chat.id;
		if (chatId === undefined) {
			return undefined;
		}
		this._lastChatID = chatId;

		if (!(await this.sendMessage(question, RESPONSE_TYPE.TEXT, chatId))) {
			return undefined;
		}

		return new Promise<string>((resolve) => {
			this._openQuestions.push(resolve);
		});
	}

	public async askCancelable(
		question: string,
		message: TelegramMessage,
		res: ResWrapper,
		setCancelable: (cancel: () => void) => void
	): Promise<string | undefined> {
		// Send early
		this._finishRes(res);

		const chatId = message?.chat.id;
		if (chatId === undefined) {
			return undefined;
		}
		this._lastChatID = chatId;

		if (!(await this.sendMessage(question, RESPONSE_TYPE.TEXT, chatId))) {
			return undefined;
		}

		return new Promise<string>((resolve) => {
			this._openQuestions.push(resolve);
			setCancelable(() => {
				this._openQuestions.splice(
					this._openQuestions.indexOf(resolve),
					1
				);
			});
		});
	}

	public async sendText(
		text: string,
		message: TelegramMessage,
		res: ResWrapper
	): Promise<boolean> {
		// Send early
		this._finishRes(res);

		const chatId = message?.chat.id;
		if (chatId === undefined) {
			return false;
		}
		this._lastChatID = chatId;

		return await this.sendMessage(text, RESPONSE_TYPE.TEXT, chatId);
	}

	public isQuestion(message: TelegramMessage): boolean {
		return this._openQuestions.length > 0 && 'text' in message;
	}

	public handleQuestion(message: TelegramMessage<TelegramText>): void {
		const firstQuestion = this._openQuestions.shift();
		firstQuestion!(message.text);
	}

	public async handleMessage(
		req: TelegramReq,
		res: ResponseLike
	): Promise<void> {
		const { message, edited_message } = req.body;
		const logObj = attachMessage(res, chalk.bold(chalk.cyan('[bot]')));

		const resWrapped = new ResWrapper(res);
		const responses = await (() => {
			if (edited_message) {
				return [
					{
						type: RESPONSE_TYPE.TEXT,
						text: 'Edits unsupported',
					},
				];
			}
			if (this.isQuestion(message)) {
				this.handleQuestion(message as TelegramMessage<TelegramText>);
				return [];
			}
			if ('reply_to_message' in message) {
				return this.handleTextMessage(logObj, message, resWrapped);
			}
			if ('text' in message) {
				return this.handleTextMessage(logObj, message, resWrapped);
			}
			return [
				{
					type: RESPONSE_TYPE.TEXT,
					text: 'Message type unsupported' as string | number,
				},
			];
		})();
		attachMessage(
			logObj,
			'Return value(s)',
			chalk.bold(JSON.stringify(responses))
		);
		const sendSuccesful = (
			await Promise.all(
				responses.map(async (response) => {
					const chatId = message?.chat.id || edited_message?.chat.id;
					if (chatId === undefined) {
						return false;
					}
					this._lastChatID = chatId;
					const textParts = this._splitLongText(
						String(response.text)
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
		).every((v) => v);

		if (!resWrapped.sent) {
			if (sendSuccesful) {
				resWrapped.res.write('ok');
			} else {
				resWrapped.res.write('Error : failed to respond');
			}
			resWrapped.res.end();
		}
	}

	public toJSON(): unknown {
		return {};
	}
}
