import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const Device = new (class Device extends ModuleMeta {
	public name = 'device';

	public async init(config: ModuleConfig<Device>) {}
})();
