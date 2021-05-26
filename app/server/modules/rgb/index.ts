import { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { Bot } from './bot';
import { ExternalHandler } from './external';
import { initListeners } from './init-listeners';
import { initRouting } from './routing';
import { scanRGBControllers } from './scan';

export const RGB = new (class Meta extends ModuleMeta {
	name = 'rgb';

	setup!: Promise<void>;

	async init(config: ModuleConfig) {
		await (this.setup = new Promise((resolve) => {
			void (async () => {
				await scanRGBControllers(true);
				setInterval(() => {
					void scanRGBControllers();
				}, 1000 * 60 * 60);
				await ExternalHandler.init();
				initListeners();

				initRouting(config);
			})().then(resolve);
		}));
	}

	get External() {
		return ExternalHandler;
	}

	get Bot() {
		return Bot;
	}
})();
