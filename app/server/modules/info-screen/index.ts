import { initRouting } from './routing';
import { ModuleMeta } from '../meta';
import { refresh } from './calendar';
import { ModuleConfig } from '..';
import { Bot } from './bot';

export const InfoScreen = new (class Meta extends ModuleMeta {
	public name = 'info-screen';

	public setup!: Promise<void>;

	public get Bot() {
		return Bot;
	}

	public async init(config: ModuleConfig) {
		initRouting(config);
		await refresh();
	}
})();
