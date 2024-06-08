import { initListeners } from './init-listeners';
import { ExternalHandler } from './external';
import { scanRGBControllers } from './scan';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { Bot } from './bot';

export const RGB = new (class RGB extends ModuleMeta {
	public name = 'rgb';

	public setup!: Promise<void>;

	public get External() {
		return ExternalHandler;
	}

	public get Bot() {
		return Bot;
	}

	public async init(config: ModuleConfig<RGB>) {
		await (this.setup = new Promise((resolve) => {
			void (async () => {
				void scanRGBControllers(true);
				setInterval(
					() => {
						void scanRGBControllers();
					},
					1000 * 60 * 60
				);
				await ExternalHandler.init();
				initListeners();

				initRouting(config);
			})().then(resolve);
		}));
	}

	public async onBackOnline() {
		await scanRGBControllers(true);
		setInterval(
			() => {
				void scanRGBControllers();
			},
			1000 * 60 * 60
		);
	}
})();
