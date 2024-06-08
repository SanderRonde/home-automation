import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { refresh } from './calendar';
import { ModuleMeta } from '../meta';
import { Bot } from './bot';

export const InfoScreen = new (class InfoScreen extends ModuleMeta {
	public name = 'info-screen';

	public setup!: Promise<void>;

	public get Bot() {
		return Bot;
	}

	public async init(config: ModuleConfig<InfoScreen>) {
		initRouting(config);
		await refresh();
	}
})();
