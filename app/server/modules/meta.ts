import { SettablePromise } from '../lib/settable-promise';
import type { ModuleConfig, AllModules } from './modules';
import { HOME_STATE } from './home-detector/types';
import { BotStateBase } from '../lib/bot-state';
import type { Routes } from '../lib/routes';
import type { SQL } from 'bun';

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
	public abstract name: string;
	public _modules = new SettablePromise<AllModules>();
	public _sqlDB = new SettablePromise<SQL>();

	public _dbName: string | null = null;
	public _loggerName: string | null = null;

	public get Bot(): typeof BotBase {
		return BotBase;
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

	public abstract init(config: ModuleConfig):
		| {
				routes: Routes;
		  }
		| Promise<{ routes: Routes }>;

	public postInit(): Promise<void> {
		return Promise.resolve(void 0);
	}

	public notifyModulesFromExternal(modules: AllModules): void {
		this._modules.set(modules);
		let initialSelfChangeDone: boolean = false;
		modules.homeDetector.onUpdate(async (homeState, name) => {
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

	public onOffline(): Promise<void> | void {}
	public onBackOnline(): Promise<void> | void {}
}
