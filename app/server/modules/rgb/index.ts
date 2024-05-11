import { initListeners } from '@server/modules/rgb/init-listeners';
import { ExternalHandler } from '@server/modules/rgb/external';
import { scanRGBControllers } from '@server/modules/rgb/scan';
import { initRouting } from '@server/modules/rgb/routing';
import { ModuleMeta } from '@server/modules/meta';
import { ModuleConfig } from '..';
import { Bot } from '@server/modules/rgb/bot';

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
