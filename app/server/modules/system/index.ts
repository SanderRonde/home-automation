import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const System = new (class System extends ModuleMeta {
	public name = 'system';

	public init(config: ModuleConfig) {
		return {
			serve: initRouting(config),
		};
	}
})();
