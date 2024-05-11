import { ExternalHandler } from './external';
import { initRouting } from './routing';
import { ModuleMeta } from '../meta';
import { ModuleConfig } from '..';
import { Bot } from './bot';

export const Cast = new (class Cast extends ModuleMeta {
	public name = 'cast';

	public get External() {
		return ExternalHandler;
	}

	public get Bot() {
		return Bot;
	}

	public async init(config: ModuleConfig<Cast>) {
		await initRouting(config);
	}
})();
