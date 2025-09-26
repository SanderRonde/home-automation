import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export interface MCPDB {
	authKeys?: string[];
}

export const MCP = new (class MCP extends ModuleMeta {
	public name = 'mcp';

	public async init(config: ModuleConfig) {
		return {
			serve: await initRouting(config),
		};
	}
})();
