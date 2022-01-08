import { ExternalHandler } from './external';
import { initRouting } from './routing';
import { ModuleMeta } from '../meta';
import { ModuleConfig } from '..';
import { Bot } from './bot';

export const Script = new (class Meta extends ModuleMeta {
	public name = 'script';

	public get External() {
		return ExternalHandler;
	}

	public get Bot() {
		return Bot;
	}

	public init(config: ModuleConfig) {
		initRouting(config);

		return Promise.resolve(void 0);
	}
})();
