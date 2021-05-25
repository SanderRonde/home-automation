import {
	LOCAL_URLS as _LOCAL_URLS,
	PASTAS as _PASTAS,
} from '../../config/casts';
import { ModuleMeta } from '../meta';
import { Bot } from './bot';
import { initRouting } from './routing';
import { ModuleConfig } from '..';
import { ExternalHandler } from './external';

export const Cast = new (class Meta extends ModuleMeta {
	name = 'cast';

	async init(config: ModuleConfig) {
		await initRouting(config);
	}

	get External() {
		return ExternalHandler;
	}

	get Bot() {
		return Bot;
	}
})();
