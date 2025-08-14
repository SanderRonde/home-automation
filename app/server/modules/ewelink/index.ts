import { initRouting } from './routing';
import eWelink from 'ewelink-api-next';
import { initEWeLinkAPI } from './api';
import type { ModuleConfig } from '..';
import { getEnv } from '../../lib/io';
import { ModuleMeta } from '../meta';

export const EWeLink = new (class EWeLink extends ModuleMeta {
	private _ewelinkApiInstance: {
		refreshWebsocket?(): Promise<void>;
	} | null = null;
	// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
	private __api: InstanceType<typeof eWelink.WebAPI> | null = null;
	public name = 'ewelink';

	private get _api() {
		const appId = getEnv('SECRET_EWELINK_APP_ID', true);
		const appSecret = getEnv('SECRET_EWELINK_APP_SECRET', true);
		const region = getEnv('SECRET_EWELINK_REGION', true);

		if (appId && appSecret && region) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			this.__api ??= new eWelink.WebAPI({
				appId,
				appSecret,
				region,
			});
		}

		return this.__api;
	}

	public init(config: ModuleConfig<EWeLink>) {
		initRouting(config, this._api);
		void initEWeLinkAPI(config.db, this._api, (devices) => {
			config.modules.device.setDevices(devices);
		});
	}

	public async onBackOnline() {
		if (!this._ewelinkApiInstance) {
			return;
		}

		await this._ewelinkApiInstance.refreshWebsocket?.();
	}
})();
