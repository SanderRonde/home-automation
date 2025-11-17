import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { refresh } from './calendar';
import { ModuleMeta } from '../meta';

export const InfoScreen = new (class InfoScreen extends ModuleMeta {
	public name = 'info-screen';

	public setup!: Promise<void>;

	public async init(config: ModuleConfig) {
		await initRouting(config);
		await refresh();

		return {
			serve: {},
		};
	}
})();
