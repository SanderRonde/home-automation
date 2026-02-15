import { DeviceClusterName, type DeviceThreeDPrinterCluster } from '../device/cluster';
import type { BambuLabDB, BambuLabConfig } from './types';
import { BambuLabP1PDevice } from './client/device';
import { logTag } from '../../lib/logging/logger';
import { DeviceSource } from '../device/device';
import type { Database } from '../../lib/db';
import { MappedData } from '../../lib/data';
import { BambuLabAPI } from './client/api';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const BambuLab = new (class BambuLab extends ModuleMeta {
	public name = 'bambulab';
	private _api: BambuLabAPI | null = null;
	private _config: ModuleConfig | null = null;

	public init(moduleConfig: ModuleConfig) {
		this._config = moduleConfig;
		const db = moduleConfig.db as Database<BambuLabDB>;

		// Subscribe to config changes
		const configData = new MappedData(db, (data) => data.config);
		configData.subscribe(async (config) => {
			if (!config) {
				this._disconnectClient();
				return;
			}

			if (config.enabled !== false) {
				await this._connectClient(config, moduleConfig);
			} else {
				this._disconnectClient();
			}
		});

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
				printerConfig.accessCode
			);
			const device = new BambuLabP1PDevice(this._api);
			(await moduleConfig.modules.device.api.value).setDevices(
				[device],
				DeviceSource.BAMBU_LAB
			);
			this._api.status.subscribe(async (status) => {
				if (!status) {
					return;
				}
				// Callback for status updates
				const db = moduleConfig.db as Database<BambuLabDB>;
				db.update((old) => ({
					...old,
					lastStatus: status,
				}));

				// Publish to WebSocket
				await moduleConfig.wsPublish(
					JSON.stringify({
						type: 'status_update',
						data: status,
					})
				);
			});

			// Sync AMS tray remaining percentage to filament module
			const deviceId = device.getUniqueId();
			const printerCluster = device.clusters.find(
				(c) => c.getBaseCluster().clusterName === DeviceClusterName.THREE_D_PRINTER
			) as DeviceThreeDPrinterCluster | undefined;
			if (printerCluster?.ams) {
				printerCluster.ams.subscribe((amsData) => {
					if (!amsData?.trays) {
						return;
					}
					const trays = amsData.trays;
					void moduleConfig.modules.filament.api.value.then((filamentAPI) => {
						trays.forEach((tray, index) => {
							if (tray.empty || ('remaining' in tray && tray.remaining === -1)) {
								return;
							}
							const remaining = 'remaining' in tray ? tray.remaining : undefined;
							if (remaining === undefined) {
								return;
							}
							const assignment = filamentAPI.getAssignment(deviceId, index);
							if (assignment?.filamentId) {
								filamentAPI.updateFilamentPercentage(
									assignment.filamentId,
									remaining
								);
							}
						});
					});
				});
			}

			await this._api.connect();
		} catch (error) {
			logTag('bambulab', 'red', 'Failed to connect to printer:', error);
			this._api = null;
		}
	}

	private async _disconnectClient() {
		if (this._api) {
			this._api.disconnect();
			this._api = null;
			(await this._config?.modules.device.api.value)?.setDevices([], DeviceSource.BAMBU_LAB);
			logTag('bambulab', 'yellow', 'Disconnected from printer');
		}
	}

	public override async onOffline() {
		// Pause monitoring when system goes offline
		this._disconnectClient();
	}

	public override async onBackOnline() {
		// Reconnect when system comes back online
		if (!this._config) {
			return;
		}

		const db = this._config.db as Database<BambuLabDB>;
		const config = db.current()?.config;
		if (config && config.enabled !== false) {
			await this._connectClient(config, this._config);
		}
	}

	public getStatus() {
		return this._api?.status.current() ?? null;
	}

	public getVideoStreamUrl(): string | undefined {
		if (!this._config) {
			return undefined;
		}
		const db = this._config.db as Database<BambuLabDB>;
		return db.current()?.config?.videoStreamUrl;
	}
})();
