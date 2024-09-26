import { createExternalClass } from '../../lib/external';
import type { HomeAssistantAPI } from './api';

export class ExternalHandler extends createExternalClass(true) {
	private static _api: HomeAssistantAPI | null = null;

	public static async init({
		api,
	}: {
		api: HomeAssistantAPI | null;
	}): Promise<void> {
		this._api = api;
		await super.init();
	}

	public async setState(
		domain: string,
		service: string,
		entityId: string
	): Promise<boolean> {
		return this.runRequest((res) => {
			if (!ExternalHandler._api) {
				return true;
			}
			return ExternalHandler._api.setState(
				res,
				domain,
				service,
				entityId
			);
		});
	}

	public async getState(service: string, entityId: string): Promise<void> {
		return this.runRequest((res) => {
			if (!ExternalHandler._api) {
				return;
			}
			return ExternalHandler._api.getState(res, service, entityId);
		});
	}
}
