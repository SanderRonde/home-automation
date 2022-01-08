import { AllModules, getAllModules } from '../..';
import { Database } from '../../../lib/db';
import { BotBase } from '../../meta';

type ChatStateType = {
	[K in keyof AllModules]: BotBase;
};

type ChatStateInitJSON = Record<keyof AllModules, unknown>;

export class ChatState {
	public states!: ChatStateType;

	public async init(
		json: ChatStateInitJSON = {} as Record<keyof AllModules, unknown>
	): Promise<this> {
		this.states = {} as ChatStateType;

		const modules = await getAllModules();
		Object.keys(modules).map((key: keyof AllModules) => {
			const meta = modules[key];
			const Bot = meta.Bot;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const param = json[key] || ({} as any);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			this.states[key] = new Bot(param);
		});
		return this;
	}

	public async toJSON(): Promise<Record<keyof AllModules, unknown>> {
		const obj: Partial<Record<keyof AllModules, unknown>> = {};

		const modules = await getAllModules();
		Object.keys(modules).forEach((key: keyof AllModules) => {
			obj[key] = this.states[key].toJSON();
		});

		return obj as Record<keyof AllModules, unknown>;
	}
}

export class StateKeeper {
	public chatIds: Map<number, ChatState> = new Map();

	public constructor(private readonly _db: Database) {}

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

	public async init(): Promise<this> {
		await this._restoreFromDB();
		return this;
	}

	public async getState(chatId: number): Promise<ChatState> {
		if (!this.chatIds.has(chatId)) {
			this.chatIds.set(chatId, await new ChatState().init());
		}
		return this.chatIds.get(chatId)!;
	}

	public updateState(chatId: number): void {
		this._saveChat(chatId);
	}
}
