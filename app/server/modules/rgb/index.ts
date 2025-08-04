import { initListeners } from './init-listeners';
import { scanRGBControllers } from './scan';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const RGB = new (class RGB extends ModuleMeta {
	public name = 'rgb';

	public init(config: ModuleConfig<RGB>) {
		void scanRGBControllers(true);
		setInterval(
			() => {
				void scanRGBControllers();
			},
			1000 * 60 * 60
		);
		initListeners();

		initRouting(config);
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
