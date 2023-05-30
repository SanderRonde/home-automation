import { initSecretModule } from '../../config/secret';
import { ModuleMeta } from '../meta';
import { ModuleConfig } from '..';

export const Secret = new (class Meta extends ModuleMeta {
	public name = 'secret';

	public init(config: ModuleConfig) {
		return initSecretModule(config);
	}
})();
