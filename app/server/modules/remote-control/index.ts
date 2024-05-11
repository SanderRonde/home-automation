import { ExternalHandler } from '@server/modules/remote-control/external';
import { initRouting } from '@server/modules/remote-control/routing';
import { ModuleMeta } from '@server/modules/meta';
import { ModuleConfig } from '..';
import { Bot } from '@server/modules/remote-control/bot';

export const RemoteControl = new (class RemoteControl extends ModuleMeta {
	public name = 'remote-control';

	public get External() {
		return ExternalHandler;
	}

	public get Bot() {
		return Bot;
	}

	public init(config: ModuleConfig<RemoteControl>) {
		initRouting(config);
	}
})();
