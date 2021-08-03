import { ExternalHandler } from './external';
import { initEWeLinkAPI } from './api';
import { ModuleMeta } from '../meta';
import { AllModules } from '..';

export const EWeLink = new (class Meta extends ModuleMeta {
	name = 'ewelink';

	init() {
		return Promise.resolve(void 0);
	}

	async notifyModules(modules: unknown) {
		void (async () => {
			await initEWeLinkAPI(modules as AllModules);
		})();
		return Promise.resolve(void 0);
	}

	get External() {
		return ExternalHandler;
	}
})();
