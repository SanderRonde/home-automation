import chalk from 'chalk';
import { Detector } from './classes';
import { APIHandler } from './api';
import { ExternalHandler } from './external';
import { initRouting } from './routing';
import { HOME_STATE } from './types';
import { handleHooks } from './hooks';
import { ModuleMeta } from '../meta';
import { ModuleConfig } from '..';
import { Bot } from './bot';
import { logTag } from '../../lib/logger';

export const HomeDetector = new (class Meta extends ModuleMeta {
	name = 'home-detector';

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
			await handleHooks(newState, name);
		});
	}

	async init(config: ModuleConfig) {
		const detector = new Detector({ db: config.db });
		const apiHandler = new APIHandler({ detector });
		Bot.init({ apiHandler, detector });
		await ExternalHandler.init({ detector });

		this._initListeners();
		initRouting({ ...config, detector, apiHandler });
	}

	get external() {
		return ExternalHandler;
	}

	get bot() {
		return Bot;
	}
})();
