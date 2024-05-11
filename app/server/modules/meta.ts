import { ModuleConfig, AllModules } from '@server/modules/modules';
import { HOME_STATE } from '@server/modules/home-detector/types';
import { BotStateBase } from '@server/lib/bot-state';
import { ExplainHook } from '@server/modules/explain/types';
import { SettablePromise } from '@server/lib/util';
import { LogObj } from '@server/lib/logger';

export declare class Handler {
	public constructor(_logObj: LogObj, _source: string);
}

class HandlerDefault implements Handler {
	public constructor() {}
}

export class BotBase extends BotStateBase {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public constructor(_json?: unknown) {
		super();
		return this;
	}

	public toJSON(): unknown {
		return {};
	}
}

export abstract class ModuleMeta {
	private _explainHook = new SettablePromise<ExplainHook>();
	public abstract name: string;
	public _modules = new SettablePromise<AllModules>();

	public _dbName: string | null = null;
	public _loggerName: string | null = null;

	public get External(): typeof Handler {
		return HandlerDefault;
	}

	public get Bot(): typeof BotBase {
		return BotBase;
	}

	// eslint-disable-next-line @typescript-eslint/ban-types
	public get schema(): {} {
		return {} as const;
	}

	public get explainHook(): Promise<ExplainHook> {
		return this._explainHook.value;
	}

	public get modules(): Promise<AllModules> {
		return this._modules.value;
	}

	public get dbName(): string {
		return this._dbName || this.name;
	}

	public get loggerName(): string {
		return this._loggerName || `/${this.name}`;
	}

	public abstract init(config: ModuleConfig<this>): Promise<void> | void;

	public postInit(): Promise<void> {
		return Promise.resolve(void 0);
	}

	public notifyModulesFromExternal(modules: AllModules): void {
		this._modules.set(modules);
		const external = new modules.homeDetector.External(
			{},
			`META.${this.name}`
		);

		let initialSelfChangeDone: boolean = false;
		void external.onUpdate(async (homeState, name) => {
			if (name !== 'self') {
				return;
			}
			if (!initialSelfChangeDone) {
				initialSelfChangeDone = true;
				return;
			}
			if (homeState === HOME_STATE.HOME) {
				await this.onBackOnline();
			} else {
				await this.onOffline();
			}
		});
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public addExplainHook(_onAction: ExplainHook): void {}

	public addExplainHookFromExternal(onAction: ExplainHook): void {
		this._explainHook.set(onAction);
		this.addExplainHook(onAction);
	}

	public onOffline(): Promise<void> | void {}
	public onBackOnline(): Promise<void> | void {}
}
