import eWelink from '../../../../temp/ewelink-api-next';
import { initRouting } from './routing';
import { initEWeLinkAPI } from './api';
import { getEnv } from '../../lib/io';
import { ModuleMeta } from '../meta';
import { ModuleConfig } from '..';

export const EWeLink = new (class Meta extends ModuleMeta {
	private _ewelinkApiInstance: {
		refreshWebsocket?(): Promise<void>;
	} | null = null;
	private __api: InstanceType<typeof eWelink.WebAPI> | null = null;
	public name = 'ewelink';

	private get _api() {
		const appId = getEnv('SECRET_EWELINK_APP_ID', true);
		const appSecret = getEnv('SECRET_EWELINK_APP_SECRET', true);
		const region = getEnv('SECRET_EWELINK_REGION', true);

		if (appId && appSecret && region) {
			this.__api ??= new eWelink.WebAPI({
				appId,
				appSecret,
				region,
			});
		}

		return this.__api;
	}

	public init(config: ModuleConfig) {
		initRouting(config, this._api);
		void (async () => {
			const modules = await this.modules;
			await initEWeLinkAPI(config.db, modules, this._api);
		})();
	}

	public async onBackOnline() {
		if (!this._ewelinkApiInstance) {
			return;
		}

		await this._ewelinkApiInstance.refreshWebsocket?.();
	}
})();
