import { ModuleConfig, AllModules } from './modules';
import { BotState } from '../lib/bot-state';
import { SettablePromise } from '../lib/util';
import { LogObj } from '../lib/logger';
import { ExplainHook } from './explain/types';

export declare class Handler {
	constructor(_logObj: LogObj, _source: string);
}

class HandlerDefault implements Handler {
	// @ts-ignore
	constructor(private _logObj: LogObj, private _source: string) {}
}

export class BotBase extends BotState.Base {
	constructor(_json?: unknown) {
		super();
		return this;
	}

	toJSON(): unknown {
		return {};
	}
}

export abstract class ModuleMeta {
	private _explainHook = new SettablePromise<ExplainHook>();
	private _modules = new SettablePromise<AllModules>();

	abstract name: string;
	public _dbName: string | null = null;
	public _loggerName: string | null = null;

	abstract init(config: ModuleConfig): Promise<void>;
	postInit(): Promise<void> {
		return Promise.resolve(void 0);
	}

	get external():
		| {
				Handler: typeof Handler;
		  }
		| typeof Handler {
		return {
			Handler: HandlerDefault,
		};
	}

	get bot():
		| {
				Bot: typeof BotBase;
		  }
		| typeof BotBase {
		return {
			Bot: BotBase,
		};
	}

	get explainHook(): Promise<ExplainHook> {
		return this._explainHook.value;
	}

	get modules(): Promise<AllModules> {
		return this._modules.value;
	}

	async notifyModules(_modules: unknown): Promise<void> {}

	async notifyModulesFromExternal(modules: AllModules): Promise<void> {
		this._modules.set(modules);
		await this.notifyModules(modules);
	}

	addExplainHook(_onAction: ExplainHook): void {}

	addExplainHookFromExternal(onAction: ExplainHook): void {
		this._explainHook.set(onAction);
		this.addExplainHook(onAction);
	}

	get dbName(): string {
		return this._dbName || this.name;
	}

	get loggerName(): string {
		return this._loggerName || `/${this.name}`;
	}
}
