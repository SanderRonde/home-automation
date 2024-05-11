import { ExternalHandler } from '@server/modules/bot/external';
import { initRouting } from '@server/modules/bot/routing';
import { ModuleMeta } from '@server/modules/meta';
import { ModuleConfig } from '..';

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
