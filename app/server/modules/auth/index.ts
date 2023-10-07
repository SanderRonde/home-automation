import { ExternalHandler } from './external';
import { initRoutes } from './routing';
import { ModuleMeta } from '../meta';
import { ModuleConfig } from '..';

export const Auth = new (class Meta extends ModuleMeta {
	public name = 'auth';

	public get External() {
		return ExternalHandler;
	}

	public init(config: ModuleConfig) {
		initRoutes(config);
	}
})();
