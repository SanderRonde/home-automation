import { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { Bot } from './bot';
import { ExternalHandler } from './external';
import { initRouting } from './routing';

export const Script = new (class Meta extends ModuleMeta {
	name = 'script';

	init(config: ModuleConfig) {
		initRouting(config);

		return Promise.resolve(void 0);
	}

	get external() {
		return ExternalHandler;
	}

	get bot() {
		return Bot;
	}
})();
