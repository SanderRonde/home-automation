import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { createServeOptions } from '../../lib/routes';
import { initRouting } from './routing';

export const DeviceProxy = new (class DeviceProxy extends ModuleMeta {
	public name = 'device-proxy';
	public _loggerName = '/device-proxy';

	public async init(config: ModuleConfig) {
		const routing = await initRouting(config);
		return {
			serve: createServeOptions(routing, true),
		};
	}
})();
