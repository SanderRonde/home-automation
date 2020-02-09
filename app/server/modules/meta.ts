import { ModuleConfig, AllModules } from './modules';
import { BotState } from '../lib/bot-state';
import { ExplainHook } from './explain';

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
	abstract name: string;
	public _dbName: string | null = null;
	public _loggerName: string | null = null;

	abstract async init(config: ModuleConfig): Promise<void>;

	get external(): {
		Handler: typeof Handler;
	} {
		return {
			Handler: HandlerDefault
		};
	}

	get bot(): {
		Bot: typeof BotBase;
	} {
		return {
			Bot: BotBase
		};
	}

	async notifyModules(_modules: AllModules): Promise<any> {}

	addExplainHook(_onAction: ExplainHook) {}

	get dbName() {
		return this._dbName || this.name;
	}

	get loggerName() {
		return this._loggerName || `/${this.name}`;
	}
}
