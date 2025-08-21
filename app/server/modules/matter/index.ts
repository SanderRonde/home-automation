import { SettablePromise } from '../../lib/settable-promise';
import { MatterClient } from './client/client';
import type { ModuleConfig } from '../modules';
import { ModuleMeta } from '../meta';

export const Matter = new (class Matter extends ModuleMeta {
	public name = 'matter';

	public client = new SettablePromise<MatterClient>();

	public init(config: ModuleConfig<Matter>) {
		const matterClient = new MatterClient();
		this.client.set(matterClient);
		matterClient.start();
		matterClient.devices.listen((devices) => {
			config.modules.device.setDevices(Object.values(devices));
		}, true);
	}
})();
