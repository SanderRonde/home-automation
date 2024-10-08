import { initAuthorization } from './authorization';
import { ExternalHandler } from './external';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const OAuth = new (class OAuth extends ModuleMeta {
	public name = 'oauth';

	public get External() {
		return ExternalHandler;
	}

	public async init(config: ModuleConfig<OAuth>) {
		initAuthorization(config.db);
		await initRouting(config);
		await ExternalHandler.init();
	}
})();
