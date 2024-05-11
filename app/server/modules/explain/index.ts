import { ExternalHandler } from '@server/modules/explain/external';
import { initHooks } from '@server/modules/explain/explaining';
import { initRouting } from '@server/modules/explain/routing';
import { ModuleMeta } from '@server/modules/meta';
import { ModuleConfig } from '..';
import { Bot } from '@server/modules/explain/bot';

export const Explain = new (class Explain extends ModuleMeta {
	public name = 'explain';

	public get External() {
		return ExternalHandler;
	}

	public get Bot() {
		return Bot;
	}

	public init(config: ModuleConfig<Explain>) {
		initRouting({ ...config });
		initHooks(config.modules);
	}
})();
