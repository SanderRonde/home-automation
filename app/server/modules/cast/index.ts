import {
	LOCAL_URLS as _LOCAL_URLS,
	PASTAS as _PASTAS,
} from '../../config/casts';
import { Bot as _Bot } from '../bot';
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

	get external() {
		return ExternalHandler;
	}

	get bot() {
		return Bot;
	}
})();
