import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const Webhook = new (class Webhook extends ModuleMeta {
	public name = 'webhook';

	public init(config: ModuleConfig<Webhook>) {
		initRouting(config);
	}
})();
