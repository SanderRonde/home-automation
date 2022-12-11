import { AllModules, ModuleConfig } from '..';
import { ExternalHandler } from './external';
import { Client } from '@notionhq/client';
import { startGeocoder } from './geocode';
import { createClient } from './client';
import { ModuleMeta } from '../meta';

type Secret = {
	init(config: ModuleConfig, client: Client): Promise<void>;
	start(
		config: ModuleConfig,
		client: Client,
		allModules: AllModules
	): Promise<void>;
};

export const Notion = new (class Meta extends ModuleMeta {
	private _client: Client | null = null;
	private _config: ModuleConfig | null = null;

	public name = 'notion';

	public get External() {
		return ExternalHandler;
	}

	private async _getSecret(): Promise<Secret | null> {
		try {
			// @ts-ignore
			return (await import('./secret')) as Secret;
		} catch (e) {
			return null;
		}
	}

	public async init(config: ModuleConfig) {
		this._client = createClient();
		this._config = config;
		if (!this._client) {
			return Promise.resolve();
		}
		const secret = await this._getSecret();
		if (secret) {
			await secret.init(config, this._client);
		}
		await ExternalHandler.init(this._client);
		return Promise.resolve();
	}

	public async postInit() {
		await startGeocoder(this._client!);
		const secret = await this._getSecret();
		if (secret) {
			void (async () => {
				const modules = await this._modules.value;
				await secret.start(this._config!, this._client!, modules);
			})();
		}
	}
})();
