import { AllModules, getAllModules } from '../..';
import { Database } from '../../../lib/db';
import { BotBase } from '../../meta';

type ChatStateType = {
	[K in keyof AllModules]: BotBase;
};

type ChatStateInitJSON = Record<keyof AllModules, unknown>;

export class ChatState {
	states!: ChatStateType;

	async init(
		json: ChatStateInitJSON = {} as Record<keyof AllModules, unknown>
	): Promise<this> {
		this.states = {} as ChatStateType;

		const modules = await getAllModules();
		Object.keys(modules).map((key: keyof AllModules) => {
			const module = modules[key];
			const meta = 'meta' in module ? module.meta : module;
			const bot = meta.bot;
			const Bot = typeof bot === 'function' ? bot : bot.Bot;
			this.states[key] = new Bot(json[key] || {});
		});
		return this;
	}

	async toJSON(): Promise<Record<keyof AllModules, unknown>> {
		const obj: Partial<Record<keyof AllModules, unknown>> = {};

		const modules = await getAllModules();
		Object.keys(modules).forEach((key: keyof AllModules) => {
			obj[key] = this.states[key].toJSON();
		});

		return obj as Record<keyof AllModules, unknown>;
	}
}

export class StateKeeper {
	chatIds: Map<number, ChatState> = new Map();

	constructor(private _db: Database) {}

	async init(): Promise<this> {
		await this._restoreFromDB();
		return this;
	}

	private async _restoreFromDB() {
		const data = await this._db.data();
		for (const requestId in data) {
			this.chatIds.set(
				parseInt(requestId, 10),
				await new ChatState().init(data[requestId] as ChatStateInitJSON)
			);
		}
	}

	private _saveChat(chatId: number) {
		this._db.setVal(
			String(chatId),
			JSON.stringify(this.chatIds.get(chatId)!)
		);
	}

	async getState(chatId: number): Promise<ChatState> {
		if (!this.chatIds.has(chatId)) {
			this.chatIds.set(chatId, await new ChatState().init());
		}
		return this.chatIds.get(chatId)!;
	}

	updateState(chatId: number): void {
		this._saveChat(chatId);
	}
}
