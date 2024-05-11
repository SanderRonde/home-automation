import { initHomeGraph, requestSync } from '@server/modules/smart-home/home-graph';
import { initRouting } from '@server/modules/smart-home/routing';
import { ModuleMeta } from '@server/modules/meta';
import { ModuleConfig } from '..';

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
