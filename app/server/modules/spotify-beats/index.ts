import { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { Bot } from './bot';
import { ExternalHandler } from './external';
import { initRouting } from './routing';

export const SpotifyBeats = new (class Meta extends ModuleMeta {
	name = 'spotify-beats';

	async init(config: ModuleConfig) {
		await ExternalHandler.init();
		initRouting(config);
	}

	get External() {
		return ExternalHandler;
	}

	get Bot() {
		return Bot;
	}
})();
