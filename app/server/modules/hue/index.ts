import { discoverBridge } from './discover-bridge';
import { linkHueDevices } from '../../config/hue';
import { logTag } from '../../lib/logger';
import { getEnv } from '../../lib/io';
import { ModuleMeta } from '../meta';
import { AllModules } from '..';

export const Hue = new (class Meta extends ModuleMeta {
	public name = 'hue';

	public init() {
		return Promise.resolve();
	}

	public async notifyModules(modules: unknown) {
		// If you don't have a username, uncomment this line and run the server once
		// Be sure to press the connect button before calling this!
		// await createUser();

		const hueUsername = getEnv('SECRET_HUE_USERNAME');
		if (!hueUsername) {
			return;
		}
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
		await linkHueDevices(bridge, modules as AllModules);
	}
})();
