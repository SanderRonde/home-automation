import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { APIHandler } from './api';

export const Config = new (class Config extends ModuleMeta {
	public name = 'config';

	public init(config: ModuleConfig<Config>) {
		const apiHandler = new APIHandler(config.modules);
		initRouting({ ...config, apiHandler });
	}
})();
