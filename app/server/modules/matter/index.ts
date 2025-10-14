import { SettablePromise } from '../../lib/settable-promise';
import { DeviceSource } from '../device/device';
import { MatterServer } from './server/server';
import type { ModuleConfig } from '../modules';
import { ModuleMeta } from '../meta';

export const Matter = new (class Matter extends ModuleMeta {
	public name = 'matter';

	public server = new SettablePromise<MatterServer>();

	public init(config: ModuleConfig) {
		const matterServer = new MatterServer();
		this.server.set(matterServer);
		void matterServer.start();
		matterServer.devices.subscribe(async (devices) => {
			if (!devices) {
				return;
			}
			const api = await config.modules.device.api.value;
			api.setDevices(Object.values(devices), DeviceSource.MATTER);
		});

		return {
			serve: {},
		};
	}
})();
