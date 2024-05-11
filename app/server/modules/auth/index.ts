import { ExternalHandler } from '@server/modules/auth/external';
import { initRoutes } from '@server/modules/auth/routing';
import { ModuleMeta } from '@server/modules/meta';
import { ModuleConfig } from '..';

export const Auth = new (class Auth extends ModuleMeta {
	public name = 'auth';

	public get External() {
		return ExternalHandler;
	}

	public init(config: ModuleConfig<Auth>) {
		initRoutes(config);
	}
})();
