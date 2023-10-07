import { initSecretModule, notifySecretModules } from '../../config/secret';
import { ModuleMeta } from '../meta';
import { ModuleConfig } from '..';

export const Secret = new (class Meta extends ModuleMeta {
	public name = 'secret';

	public async init(config: ModuleConfig) {
		await initSecretModule(config);
		void notifySecretModules(config.modules);
	}
})();
