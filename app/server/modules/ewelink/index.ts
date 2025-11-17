import { logTag } from '../../lib/logging/logger';
import { DeviceSource } from '../device/device';
import type { Database } from '../../lib/db';
import { initRouting } from './routing';
import eWelink from 'ewelink-api-next';
import type { ModuleConfig } from '..';
import { getEnv } from '../../lib/io';
import { ModuleMeta } from '../meta';
import { EWeLinkAPI } from './api';

export interface EWelinkDB {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
}

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

	public async init(config: ModuleConfig) {
		const webApi = this.getWebApi();
		const db = config.db as Database<EWelinkDB>;
		if (webApi) {
			const token = db.current()?.accessToken;
			if (!token) {
				logTag(
					'ewelink',
					'yellow',
					'No token supplied, get one by going to /ewelink/oauth'
				);
			} else {
				try {
					this.api = await new EWeLinkAPI(db, webApi, async (devices) => {
						(await config.modules.device.api.value).setDevices(
							devices,
							DeviceSource.EWELINK
						);
					}).init(token);
				} catch (e) {
					logTag(
						'ewelink',
						'yellow',
						`Failed to connect to ewelink ${e instanceof Error ? e.message : 'Unknown error'}, try re-authenticating`
					);
				}
			}
		}

		return {
			serve: initRouting(config, webApi),
		};
	}

	public override async onBackOnline() {
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
