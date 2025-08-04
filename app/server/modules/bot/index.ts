import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const Bot = new (class Bot extends ModuleMeta {
	public name = 'bot';

	public async init(config: ModuleConfig<Bot>) {
		await initRouting(config);
	}
})();
