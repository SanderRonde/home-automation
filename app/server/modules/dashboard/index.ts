import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const Dashboard = new (class Dashboard extends ModuleMeta {
	public name = 'dashboard';

	public init(config: ModuleConfig) {
		return {
			serve: initRouting(config),
		};
	}
})();
