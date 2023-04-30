import { initEWeLinkAPI } from './api';
import { ModuleMeta } from '../meta';
import { AllModules } from '..';

export const EWeLink = new (class Meta extends ModuleMeta {
	private _ewelinkApiInstance: {
		refreshWebsocket?(): Promise<void>;
	} | null = null;
	public name = 'ewelink';

	public init() {
		return Promise.resolve(void 0);
	}

	public async notifyModules(modules: unknown) {
		void (async () => {
			await initEWeLinkAPI(modules as AllModules);
		})();
		return Promise.resolve(void 0);
	}

	public async onBackOnline() {
		if (!this._ewelinkApiInstance) {
			return;
		}

		await this._ewelinkApiInstance.refreshWebsocket?.();
	}
})();
