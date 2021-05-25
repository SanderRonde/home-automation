import { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { Bot } from './bot';
import { refresh } from './calendar';
import { initRouting } from './routing';

export const InfoScreen = new (class Meta extends ModuleMeta {
	name = 'info-screen';

	setup!: Promise<void>;

	async init(config: ModuleConfig) {
		initRouting(config);
		await refresh();
	}

	get bot() {
		return Bot;
	}
})();
