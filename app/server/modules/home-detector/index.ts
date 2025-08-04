import { LogObj } from '../../lib/logging/lob-obj';
import { logTag } from '../../lib/logging/logger';
import { SettablePromise } from '../../lib/util';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { handleHooks } from './hooks';
import { Detector } from './classes';
import { HOME_STATE } from './types';
import { ModuleMeta } from '../meta';
import { APIHandler } from './api';
import { Bot } from './bot';
import chalk from 'chalk';

export const HomeDetector = new (class HomeDetector extends ModuleMeta {
	private readonly _detector: SettablePromise<Detector> =
		new SettablePromise();

	public name = 'home-detector';

	public get Bot() {
		return Bot;
	}

	private _initListeners() {
		Detector.addListener(null, (newState, name) => {
			logTag(
				`device:${name}`,
				'cyan',
				newState === HOME_STATE.HOME
					? chalk.bold(chalk.blue('now home'))
					: chalk.blue('just left')
			);
		});
		Detector.addListener(null, async (newState, name) => {
			await handleHooks(
				newState,
				name,
				LogObj.fromFixture(chalk.cyan('[hook]'), name)
			);
		});
	}

	public init(config: ModuleConfig<HomeDetector>) {
		const detector = new Detector({ db: config.db });
		const apiHandler = new APIHandler({ detector });
		Bot.init({
			apiHandler,
			detector,
		});
		this._detector.set(detector);

		this._initListeners();
		initRouting({
			...config,
			detector,
			apiHandler,
		});
	}

	public onUpdate(
		handler: (newState: HOME_STATE, name: string) => void | Promise<void>
	): void {
		Detector.addListener(null, handler);
	}
})();
