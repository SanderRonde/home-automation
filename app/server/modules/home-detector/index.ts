import { ExternalHandler } from '@server/modules/home-detector/external';
import { logTag } from '@server/lib/logger';
import { initRouting } from '@server/modules/home-detector/routing';
import { handleHooks } from '@server/modules/home-detector/hooks';
import { Detector } from '@server/modules/home-detector/classes';
import { HOME_STATE } from '@server/modules/home-detector/types';
import { ModuleMeta } from '@server/modules/meta';
import { APIHandler } from '@server/modules/home-detector/api';
import { ModuleConfig } from '..';
import { Bot } from '@server/modules/home-detector/bot';
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
			await handleHooks(newState, name);
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
