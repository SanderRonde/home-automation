import { ExternalHandler } from '@server/modules/script/external';
import { initRouting } from '@server/modules/script/routing';
import { ModuleMeta } from '@server/modules/meta';
import { ModuleConfig } from '..';
import { Bot } from '@server/modules/script/bot';

export const Script = new (class Script extends ModuleMeta {
	public name = 'script';

	public get External() {
		return ExternalHandler;
	}

	public get Bot() {
		return Bot;
	}

	public init(config: ModuleConfig<Script>) {
		initRouting(config);
	}
})();
