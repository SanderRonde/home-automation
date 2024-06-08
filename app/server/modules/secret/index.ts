import { initSecretModule, notifySecretModules } from '../../config/secret';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const Secret = new (class Secret extends ModuleMeta {
	public name = 'secret';

	public async init(config: ModuleConfig<Secret>) {
		await initSecretModule(config);
		void notifySecretModules(config.modules);
	}
})();
