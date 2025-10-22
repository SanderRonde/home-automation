import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const Dashboard = new (class Dashboard extends ModuleMeta {
	public name = 'dashboard';

	public async init(config: ModuleConfig) {
		return {
			serve: await initRouting(config),
		};
	}
})();
