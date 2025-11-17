import { buildDashboard } from './build';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export const Dashboard = new (class Dashboard extends ModuleMeta {
	public name = 'dashboard';

	public async init(config: ModuleConfig) {
		// Build client in production mode
		if (IS_PRODUCTION) {
			await buildDashboard();
		}

		return {
			serve: await initRouting(config),
		};
	}
})();
