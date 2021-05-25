import { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { ExternalHandler } from './external';
import { initRouting } from './routing';

export const Bot = new (class Meta extends ModuleMeta {
	name = 'bot';

	async init(config: ModuleConfig) {
		await initRouting(config);
		await ExternalHandler.init();
	}

	get external() {
		return ExternalHandler;
	}
})();
