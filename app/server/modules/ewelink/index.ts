import { logTag } from '../../lib/logging/logger';
import { initRouting } from './routing';
import eWelink from 'ewelink-api-next';
import type { ModuleConfig } from '..';
import { getEnv } from '../../lib/io';
import { ModuleMeta } from '../meta';
import { EWeLinkAPI } from './api';

export const EWeLink = new (class EWeLink extends ModuleMeta {
	private _ewelinkApiInstance: {
		refreshWebsocket?(): Promise<void>;
	} | null = null;
	public api: EWeLinkAPI | null = null;
	public name = 'ewelink';

	private getWebApi() {
		const appId = getEnv('SECRET_EWELINK_APP_ID', false);
		const appSecret = getEnv('SECRET_EWELINK_APP_SECRET', false);
		const region = getEnv('SECRET_EWELINK_REGION', false);

		if (appId && appSecret && region) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			return new eWelink.WebAPI({
				appId,
				appSecret,
				region,
			});
		}

		return null;
	}

	public async init(config: ModuleConfig<EWeLink>): Promise<void> {
		const webApi = this.getWebApi();
		initRouting(config, webApi);
		if (webApi) {
			const token = config.db.get<string>('accessToken');
			if (!token) {
				logTag(
					'ewelink',
					'yellow',
					'No token supplied, get one by going to /ewelink/oauth'
				);
			} else {
				this.api = await new EWeLinkAPI(
					config.db,
					webApi,
					(devices) => {
						config.modules.device.setDevices(devices);
					}
				).init(token);
			}
		}
	}

	public async onBackOnline() {
		if (!this._ewelinkApiInstance) {
			return;
		}

		await this._ewelinkApiInstance.refreshWebsocket?.();
	}

	public async refreshApi(accessToken: string) {
		if (!this.api) {
			return;
		}
		this.api = await this.api.refreshWithToken(accessToken);
	}
})();
