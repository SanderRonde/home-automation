import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { initRouting } from './routing';

export const Config = new (class Config extends ModuleMeta {
	public name = 'config';

	public init(config: ModuleConfig<Config>) {
		initRouting(this, config);
	}
})();
