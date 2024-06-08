import { ExternalHandler } from './external';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const Bot = new (class Bot extends ModuleMeta {
	public name = 'bot';

	public get External() {
		return ExternalHandler;
	}

	public async init(config: ModuleConfig<Bot>) {
		await initRouting(config);
		await ExternalHandler.init();
	}
})();
