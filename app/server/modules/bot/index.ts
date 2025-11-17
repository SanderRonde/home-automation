import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export type BotDB = Record<string, unknown>;

export const Bot = new (class Bot extends ModuleMeta {
	public name = 'bot';

	public init(config: ModuleConfig) {
		return {
			serve: initRouting(config),
		};
	}
})();
