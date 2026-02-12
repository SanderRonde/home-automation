import { ModuleMeta } from '../meta';
import type { ModuleConfig } from '..';
import type { Database } from '../../lib/db';
import { initRouting } from './routing';
import { BambuLabAPI } from './client/api';
import { logTag } from '../../lib/logging/logger';
import type { BambuLabDB, BambuLabConfig } from './types';

export const BambuLab = new (class BambuLab extends ModuleMeta {
	public name = 'bambulab';
	private _api: BambuLabAPI | null = null;
	private _config: ModuleConfig | null = null;

	public init(config: ModuleConfig) {
		this._config = config;
		const db = config.db as Database<BambuLabDB>;

		// Subscribe to config changes
		db.subscribe(async (data) => {
			if (!data?.config) {
				this._disconnectClient();
				return;
			}

			if (data.config.enabled !== false) {
				await this._connectClient(data.config, config);
			} else {
				this._disconnectClient();
			}
		});

		// Initialize on startup if config exists
		const currentConfig = db.current()?.config;
		if (currentConfig && currentConfig.enabled !== false) {
			void this._connectClient(currentConfig, config);
		}

		logTag('bambulab', 'green', 'Bambu Lab module initialized');

		return {
			serve: initRouting(db),
		};
	}

	private async _connectClient(printerConfig: BambuLabConfig, moduleConfig: ModuleConfig) {
		try {
			// Disconnect existing client
			this._disconnectClient();

			// Create new API client
			this._api = new BambuLabAPI(
				printerConfig.ip,
				printerConfig.serial,
				printerConfig.accessCode,
				async (status) => {
					// Callback for status updates
					const db = moduleConfig.db as Database<BambuLabDB>;
					await db.setVal('lastStatus', status);

					// Publish to WebSocket
					await moduleConfig.wsPublish(
						JSON.stringify({
							type: 'status_update',
							data: status,
						})
					);
				}
			);

			await this._api.connect();
			logTag('bambulab', 'green', `Connected to printer at ${printerConfig.ip}`);
		} catch (error) {
			logTag('bambulab', 'red', 'Failed to connect to printer:', error);
			this._api = null;
		}
	}

	private _disconnectClient() {
		if (this._api) {
			this._api.disconnect();
			this._api = null;
			logTag('bambulab', 'yellow', 'Disconnected from printer');
		}
	}

	public override async onOffline() {
		// Pause monitoring when system goes offline
		this._disconnectClient();
	}

	public override async onBackOnline() {
		// Reconnect when system comes back online
		if (!this._config) return;

		const db = this._config.db as Database<BambuLabDB>;
		const config = db.current()?.config;
		if (config && config.enabled !== false) {
			await this._connectClient(config, this._config);
		}
	}

	public getStatus() {
		return this._api?.getStatus() ?? null;
	}
})();
