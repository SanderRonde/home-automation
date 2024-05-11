import { ExternalHandler } from './external';
import { initRouting } from './routing';
import { ModuleMeta } from '../meta';
import { ModuleConfig } from '..';
import { Bot } from './bot';

export const SpotifyBeats = new (class SpotifyBeats extends ModuleMeta {
	public name = 'spotify-beats';

	public get External() {
		return ExternalHandler;
	}

	public get Bot() {
		return Bot;
	}

	public async init(config: ModuleConfig<SpotifyBeats>) {
		await ExternalHandler.init();
		initRouting(config);
	}
})();
