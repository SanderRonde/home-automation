import { ExternalHandler } from '@server/modules/spotify-beats/external';
import { initRouting } from '@server/modules/spotify-beats/routing';
import { ModuleMeta } from '@server/modules/meta';
import { ModuleConfig } from '..';
import { Bot } from '@server/modules/spotify-beats/bot';

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
