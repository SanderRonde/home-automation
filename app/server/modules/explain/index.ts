import { ModuleConfig } from '..';
import { ExternalHandler } from './external';
import { initHooks } from './explaining';
import { initRouting } from './routing';
import { ModuleMeta } from '../meta';
import { Bot } from './bot';

export const Explain = new (class Meta extends ModuleMeta {
	public name = 'explain';

	public get External() {
		return ExternalHandler;
	}

	public get Bot() {
		return Bot;
	}

	public init(config: ModuleConfig) {
		initRouting({ ...config });
		initHooks(config.modules);
	}
})();
