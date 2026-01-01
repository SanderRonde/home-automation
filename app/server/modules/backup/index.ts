import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const Backup = new (class Backup extends ModuleMeta {
	public name = 'backup';

	public init(config: ModuleConfig) {
		return {
			serve: initRouting(config),
		};
	}
})();
