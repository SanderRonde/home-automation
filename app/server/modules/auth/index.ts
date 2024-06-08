import { ExternalHandler } from './external';
import { initRoutes } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const Auth = new (class Auth extends ModuleMeta {
	public name = 'auth';

	public get External() {
		return ExternalHandler;
	}

	public init(config: ModuleConfig<Auth>) {
		initRoutes(config);
	}
})();
