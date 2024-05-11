import { ExternalHandler } from './external';
import { initHooks } from './explaining';
import { initRouting } from './routing';
import { ModuleMeta } from '../meta';
import { ModuleConfig } from '..';
import { Bot } from './bot';

export const Explain = new (class Explain extends ModuleMeta {
	public name = 'explain';

	public get External() {
		return ExternalHandler;
	}

	public get Bot() {
		return Bot;
	}

	public init(config: ModuleConfig<Explain>) {
		initRouting({ ...config });
		initHooks(config.modules);
	}
})();
