import { SettablePromise } from '../../lib/settable-promise';
import { DeviceSource } from '../device/device';
import { MatterServer } from './server/server';
import type { ModuleConfig } from '../modules';
import { initRouting } from './routing';
import { ModuleMeta } from '../meta';

export const Matter = new (class Matter extends ModuleMeta {
	public name = 'matter';

	public server = new SettablePromise<MatterServer>();

	public init(config: ModuleConfig) {
		const matterServer = new MatterServer();
		this.server.set(matterServer);
		matterServer.start().catch((error) => {
			console.error('Matter server start error:', error);
		});
		matterServer.devices.subscribe(async (devices) => {
			if (!devices) {
				return;
			}
			try {
				const api = await config.modules.device.api.value;
				api.setDevices(Object.values(devices), DeviceSource.MATTER);
			} catch (error) {
				console.error('Error setting devices:', error);
			}
		});

		return {
			serve: initRouting(config),
		};
	}
})();
