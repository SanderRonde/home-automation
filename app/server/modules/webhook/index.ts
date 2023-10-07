import { ExternalHandler } from './external';
import { initRouting } from './routing';
import { ModuleMeta } from '../meta';
import { ModuleConfig } from '..';

export const Webhook = new (class Meta extends ModuleMeta {
	public name = 'webhook';

	public get External() {
		return ExternalHandler;
	}

	public init(config: ModuleConfig) {
		initRouting(config);
	}
})();
