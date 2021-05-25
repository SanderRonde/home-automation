import { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { initHomeGraph, requestSync } from './home-graph';
import { initRouting } from './routing';

export const SmartHome = new (class Meta extends ModuleMeta {
	name = 'smart-home';

	async init(config: ModuleConfig) {
		await initRouting(config);
		await initHomeGraph(config.db);
	}

	async postInit() {
		// Enable if list of devices should be updated as the server
		// is restarted
		await requestSync();
	}
})();
