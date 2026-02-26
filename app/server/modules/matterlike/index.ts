import { logTag, warning } from '../../lib/logging/logger';
import type { DeviceClusterName } from '../device/cluster';
import type { ServeOptions } from '../../lib/routes';
import { MatterLikeDevice } from './client/device';
import type { MatterlikeConfig } from './routing';
import { DeviceSource } from '../device/device';
import type { ModuleConfig } from '../modules';
import type { Database } from '../../lib/db';
import { initRouting } from './routing';
import { diff } from '../../lib/array';
import { Data } from '../../lib/data';
import { ModuleMeta } from '../meta';

export interface MatterlikeDB extends MatterlikeConfig {}

export const Matterlike = new (class Matterlike extends ModuleMeta {
	public devices = new Data<{
		[url: string]: MatterLikeDevice;
	}>({});

	public name = 'matterlike';

	public init(config: ModuleConfig): { serve: ServeOptions<unknown> } {
		const db = config.db as Database<MatterlikeDB>;

		db.subscribe(async (data) => {
			if (!data) {
				return;
			}
			const currentDevices = this.devices.current();
			const newDevices: { [url: string]: MatterLikeDevice } = { ...currentDevices };
			const { added, removed } = diff(Object.keys(currentDevices), data.devices ?? []);

			for (const url of added) {
				try {
					// eslint-disable-next-line no-restricted-globals
					const response = await fetch(`${url}/clusters`);
					if (response.ok) {
						const clustersData = (await response.json()) as {
							clusters: Record<DeviceClusterName, unknown>;
						};
						newDevices[url] = new MatterLikeDevice(
							url,
							Object.keys(clustersData.clusters) as DeviceClusterName[]
						);
						logTag('matterlike', 'magenta', 'Device initialized:', url);
					} else {
						logTag('matterlike', 'red', 'Failed to initialize matterlike device:', url);
					}
				} catch (error) {
					warning('Failed to initialize matterlike device:', url, error);
				}
			}

			for (const url of removed) {
				const device = currentDevices[url];
				if (device) {
					device[Symbol.dispose]();
				}
				delete newDevices[url];
			}

			this.devices.set(newDevices);

			(await config.modules.device.api.value).setDevices(
				Object.values(newDevices),
				DeviceSource.MATTER_LIKE
			);
		});

		return {
			serve: initRouting(db),
		};
	}
})();
