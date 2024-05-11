import { initSecretModule, notifySecretModules } from '@server/config/secret';
import { ModuleMeta } from '@server/modules/meta';
import { ModuleConfig } from '..';

export const Secret = new (class Secret extends ModuleMeta {
	public name = 'secret';

	public async init(config: ModuleConfig<Secret>) {
		await initSecretModule(config);
		void notifySecretModules(config.modules);
	}
})();
