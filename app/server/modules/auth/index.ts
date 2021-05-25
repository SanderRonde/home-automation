import { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { ExternalHandler } from './external';
import { initRoutes } from './routing';

export const Auth = new (class Meta extends ModuleMeta {
	name = 'auth';

	init(config: ModuleConfig) {
		initRoutes(config);

		return Promise.resolve(void 0);
	}

	get external() {
		return ExternalHandler;
	}
})();
