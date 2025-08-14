import { MatterClient } from './client/client';
import type { ModuleConfig } from '../modules';
import { ModuleMeta } from '../meta';

export const Matter = new (class Matter extends ModuleMeta {
	public name = 'matter';

	public init(config: ModuleConfig<Matter>) {
		const matterClient = new MatterClient();
		matterClient.start();
		matterClient.devices.listen((devices) => {
			config.modules.device.setDevices(Object.values(devices));
		}, true);
	}
})();
