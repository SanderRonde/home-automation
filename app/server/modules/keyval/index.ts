import type { KeyvalConfig } from './routing';
import type { Database } from '../../lib/db';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export interface KeyvalDB extends KeyvalConfig {}

export const KeyVal = new (class KeyVal extends ModuleMeta {
	public name = 'keyval';

	public init(config: ModuleConfig) {
		return {
			serve: initRouting(config, config.db as Database<KeyvalDB>),
		};
	}
})();
