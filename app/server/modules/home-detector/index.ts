import { SettablePromise } from '../../lib/settable-promise';
import { logTag } from '../../lib/logging/logger';
import type { HostsConfigDB } from './classes';
import { Database } from '../../lib/db';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { Detector } from './classes';
import { HOME_STATE } from './types';
import { ModuleMeta } from '../meta';
import { Bot } from './bot';
import chalk from 'chalk';

export type HomeDetectorDB = Record<string, HOME_STATE>;

export const HomeDetector = new (class HomeDetector extends ModuleMeta {
	private readonly _detector: SettablePromise<Detector> = new SettablePromise();

	public name = 'home-detector';

	public override get Bot() {
		return Bot;
	}

	public init(config: ModuleConfig) {
		const hostsDb = new Database<HostsConfigDB>('home-detector-hosts.json');
		const detector = new Detector({
			db: config.db as Database<HomeDetectorDB>,
			hostsDb,
		});
		Bot.init({
			detector,
		});
		this._detector.set(detector);

		detector.addListener(null, (newState, name) => {
			logTag(
				`device:${name}`,
				'cyan',
				newState === HOME_STATE.HOME
					? chalk.bold(chalk.blue('now home'))
					: chalk.blue('just left')
			);
		});

		return {
			serve: initRouting(detector, config),
		};
	}

	public async onUpdate(
		handler: (newState: HOME_STATE, name: string) => void | Promise<void>
	): Promise<void> {
		(await this._detector.value).addListener(null, handler);
	}
})();
