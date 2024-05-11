import { initAuthorization } from '@server/modules/oauth/authorization';
import { ExternalHandler } from '@server/modules/oauth/external';
import { initRouting } from '@server/modules/oauth/routing';
import { ModuleMeta } from '@server/modules/meta';
import { ModuleConfig } from '..';

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
