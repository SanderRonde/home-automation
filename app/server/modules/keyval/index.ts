import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const KeyVal = new (class KeyVal extends ModuleMeta {
	public name = 'keyval';

	public init(config: ModuleConfig) {
		return {
			serve: initRouting(config),
		};
	}
})();
