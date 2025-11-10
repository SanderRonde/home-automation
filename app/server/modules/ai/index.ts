import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export interface AIDB {
	chatgptApiKey?: string;
	mcpAuthKeys?: string[]; // For MCP server authentication
}

export const AI = new (class AI extends ModuleMeta {
	public name = 'ai';

	public init(config: ModuleConfig) {
		return {
			serve: initRouting(config),
		};
	}
})();
