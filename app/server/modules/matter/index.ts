import { MatterClient } from './client/client';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const Matter = new (class Matter extends ModuleMeta {
	public name = 'matter';

	public async init(config: ModuleConfig<Matter>) {
		const matterClient = new MatterClient();
		matterClient.start();
		console.log('Matter client started');
		void matterClient.devices.value.then((devices) => {
			console.log(1, devices);
		});
		matterClient.devices.listen((devices) => {
			console.log(2, devices);
		});
	}
})();
