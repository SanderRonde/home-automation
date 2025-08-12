import { initRoutes } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { getKey } from './secret';

export const Auth = new (class Auth extends ModuleMeta {
	public name = 'auth';

	public init(config: ModuleConfig<Auth>) {
		initRoutes(config);
	}

	public getSecretKey(): string {
		return getKey();
	}
})();
