import { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { initAuthorization } from './authorization';
import { ExternalHandler } from './external';
import { initRouting } from './routing';

export const OAuth = new (class Meta extends ModuleMeta {
	name = 'oauth';

	async init(config: ModuleConfig) {
		initAuthorization(config.db);
		await initRouting(config);
		await ExternalHandler.init();
	}

	get External() {
		return ExternalHandler;
	}
})();
