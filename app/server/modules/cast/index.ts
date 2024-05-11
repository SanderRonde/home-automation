import { ExternalHandler } from '@server/modules/cast/external';
import { initRouting } from '@server/modules/cast/routing';
import { ModuleMeta } from '@server/modules/meta';
import { ModuleConfig } from '..';
import { Bot } from '@server/modules/cast/bot';

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
