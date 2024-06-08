import { ExternalHandler } from './external';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { Bot } from './bot';

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
