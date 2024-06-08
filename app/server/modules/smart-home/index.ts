import { initHomeGraph, requestSync } from './home-graph';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const SmartHome = new (class SmartHome extends ModuleMeta {
	public name = 'smart-home';

	public async init(config: ModuleConfig<SmartHome>) {
		await initRouting(config);
		await initHomeGraph(config.db);
	}

	public async postInit() {
		// Enable if list of devices should be updated as the server
		// is restarted
		await requestSync();
	}
})();
