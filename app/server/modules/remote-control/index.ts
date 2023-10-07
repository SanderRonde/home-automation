import { ExternalHandler } from './external';
import { initRouting } from './routing';
import { ModuleMeta } from '../meta';
import { ModuleConfig } from '..';
import { Bot } from './bot';

export const RemoteControl = new (class Meta extends ModuleMeta {
	public name = 'remote-control';

	public get External() {
		return ExternalHandler;
	}

	public get Bot() {
		return Bot;
	}

	public init(config: ModuleConfig) {
		initRouting(config);
	}
})();
