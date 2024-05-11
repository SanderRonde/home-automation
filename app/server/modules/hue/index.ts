import { discoverBridge } from '@server/modules/hue/discover-bridge';
import { linkHueDevices } from '@server/config/hue';
import { logTag } from '@server/lib/logger';
import { getEnv } from '@server/lib/io';
import { ModuleMeta } from '@server/modules/meta';
import { ModuleConfig } from '..';

export const Hue = new (class Hue extends ModuleMeta {
	public name = 'hue';

	public init(config: ModuleConfig<Hue>) {
		// If you don't have a username, uncomment this line and run the server once
		// Be sure to press the connect button before calling this!
		// await createUser();

		const hueUsername = getEnv('SECRET_HUE_USERNAME');
		if (!hueUsername) {
			return;
		}
		void (async () => {
			const bridge = await (async () => {
				try {
					return await discoverBridge(hueUsername);
				} catch (e) {
					return null;
				}
			})();
			if (!bridge) {
				logTag('hue', 'red', 'Failed to connect to hue bridge');
				return;
			}
			await linkHueDevices(bridge, config.modules);
		})();
	}
})();
