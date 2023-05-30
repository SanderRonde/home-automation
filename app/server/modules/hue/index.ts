import { Api } from 'node-hue-api/dist/esm/api/Api';
import { discoverBridge } from './discover-bridge';
import { linkHueDevices } from '../../config/hue';
import { logTag } from '../../lib/logger';
import { getEnv } from '../../lib/io';
import { ModuleMeta } from '../meta';
import { AllModules } from '..';

export const Hue = new (class Meta extends ModuleMeta {
	private _bridge: Api | null = null;
	public name = 'hue';

	public async init() {
		// If you don't have a username, uncomment this line and run the server once
		// Be sure to press the connect button before calling this!
		// await createUser();

		const hueUsername = getEnv('SECRET_HUE_USERNAME');
		if (!hueUsername) {
			return;
		}
		try {
			this._bridge = await discoverBridge(hueUsername);
		} catch (e) {
			logTag('hue', 'red', 'Failed to connect to hue bridge');
		}
	}

	public async notifyModules(modules: unknown) {
		if (!this._bridge) {
			return;
		}
		await linkHueDevices(this._bridge, modules as AllModules);
	}
})();
