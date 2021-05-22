import { ModuleConfig, AllModules } from './modules';
import { BotState } from '../lib/bot-state';
import { ExplainHook } from './explain';
import { SettablePromise } from '../lib/util';

export declare class Handler {
	constructor(_logObj: any, _source: string);
}

class HandlerDefault implements Handler {
	// @ts-ignore
	constructor(private _logObj: any, private _source: string) {}
}

export class BotBase extends BotState.Base {
	constructor(_json?: any) {
		super();
		return this;
	}

	toJSON() {
		return {};
	}
}

export abstract class ModuleMeta {
	private _explainHook = new SettablePromise<ExplainHook>();
	private _modules = new SettablePromise<AllModules>();

	abstract name: string;
	public _dbName: string | null = null;
	public _loggerName: string | null = null;

	abstract async init(config: ModuleConfig): Promise<void>;

	get external(): {
		Handler: typeof Handler;
	} {
		return {
			Handler: HandlerDefault,
		};
	}

	get bot(): {
		Bot: typeof BotBase;
	} {
		return {
			Bot: BotBase,
		};
	}

	get explainHook() {
		return this._explainHook.value;
	}

	get modules() {
		return this._modules.value;
	}

	async notifyModules(_modules: AllModules): Promise<any> {}

	async notifyModulesFromExternal(modules: AllModules): Promise<any> {
		this._modules.set(modules);
		this.notifyModules(modules);
	}

	addExplainHook(_onAction: ExplainHook) {}

	addExplainHookFromExternal(onAction: ExplainHook) {
		this._explainHook.set(onAction);
		this.addExplainHook(onAction);
	}

	get dbName() {
		return this._dbName || this.name;
	}

	get loggerName() {
		return this._loggerName || `/${this.name}`;
	}
}
