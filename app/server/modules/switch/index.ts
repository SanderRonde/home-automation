import type { Database } from '../../lib/db';
import type { SwitchConfig } from './routing';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export interface SwitchDB extends SwitchConfig {}

export const Switch = new (class Switch extends ModuleMeta {
	public name = 'switch';

	public init(config: ModuleConfig) {
		return {
			serve: initRouting(config, config.db as Database<SwitchDB>),
		};
	}
})();
