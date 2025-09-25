import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const MCP = new (class MCP extends ModuleMeta {
	public name = 'mcp';

	public init(config: ModuleConfig) {
		return {
			serve: initRouting(config),
		};
	}
})();
