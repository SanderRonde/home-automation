import { AllModules, ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { Bot } from './bot';
import { initHooks } from './explaining';
import { ExternalHandler } from './external';
import { initRouting } from './routing';

export const Explain = new (class Meta extends ModuleMeta {
	name = 'explain';

	init(config: ModuleConfig) {
		initRouting({ ...config });

		return Promise.resolve(void 0);
	}

	notifyModules(modules: unknown) {
		initHooks(modules as AllModules);

		return Promise.resolve(void 0);
	}

	get external() {
		return ExternalHandler;
	}

	get bot() {
		return Bot;
	}
})();
