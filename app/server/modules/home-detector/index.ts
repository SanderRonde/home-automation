import { LogObj } from '../../lib/logging/lob-obj';
import { logTag } from '../../lib/logging/logger';
import { ExternalHandler } from './external';
import { initRouting } from './routing';
import { handleHooks } from './hooks';
import { Detector } from './classes';
import { HOME_STATE } from './types';
import { ModuleMeta } from '../meta';
import { APIHandler } from './api';
import { ModuleConfig } from '..';
import { Bot } from './bot';
import chalk from 'chalk';

export const HomeDetector = new (class HomeDetector extends ModuleMeta {
	public name = 'home-detector';

	public get External() {
		return ExternalHandler;
	}

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

	public async init(config: ModuleConfig<HomeDetector>) {
		const detector = new Detector({ db: config.db });
		const apiHandler = new APIHandler({ detector });
		Bot.init({
			apiHandler,
			detector,
		});
		await ExternalHandler.init({ detector });

		this._initListeners();
		initRouting({
			...config,
			detector,
			apiHandler,
		});
	}
})();
