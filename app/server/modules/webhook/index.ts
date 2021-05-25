import { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { ExternalHandler } from './external';
import { initRouting } from './routing';

export const Webhook = new (class Meta extends ModuleMeta {
	name = 'webhook';

	init(config: ModuleConfig) {
		initRouting(config);
		return Promise.resolve(void 0);
	}

	get External() {
		return ExternalHandler;
	}
})();
