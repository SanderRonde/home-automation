import { ExternalHandler } from '@server/modules/webhook/external';
import { initRouting } from '@server/modules/webhook/routing';
import { ModuleMeta } from '@server/modules/meta';
import { ModuleConfig } from '..';

export const Webhook = new (class Webhook extends ModuleMeta {
	public name = 'webhook';

	public get External() {
		return ExternalHandler;
	}

	public init(config: ModuleConfig<Webhook>) {
		initRouting(config);
	}
})();
