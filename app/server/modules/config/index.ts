import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const Config = new (class Config extends ModuleMeta {
	public name = 'config';

	public init(config: ModuleConfig) {
		return {
			serve: initRouting(config),
		};
	}
})();
