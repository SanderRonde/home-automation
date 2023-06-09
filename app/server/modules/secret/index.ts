import { initSecretModule, notifySecretModules } from '../../config/secret';
import { AllModules, ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const Secret = new (class Meta extends ModuleMeta {
	public name = 'secret';

	public init(config: ModuleConfig) {
		return initSecretModule(config);
	}

	public notifyModules(_modules: unknown): Promise<void> {
		const modules = _modules as AllModules;
		return notifySecretModules(modules);
	}
})();
