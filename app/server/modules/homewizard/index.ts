import { logTag, warning } from '../../lib/logging/logger';
import { HomeWizardDevice } from './client/device';
import type { HomeWizardConfig } from './routing';
import { DeviceSource } from '../device/device';
import type { Database } from '../../lib/db';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { Data } from '../../lib/data';
import { ModuleMeta } from '../meta';

export interface HomeWizardDB extends HomeWizardConfig {}

interface MeasurementResponse {
	power_w?: number;
	energy_import_kwh?: number;
	[key: string]: unknown;
}

export const HomeWizard = new (class HomeWizard extends ModuleMeta {
	public device = new Data<HomeWizardDevice | null>(null);
	public name = 'homewizard';

	private _pollingInterval: Timer | null = null;
	private _currentDelay = 15000; // Start with 15 seconds
	private readonly _minDelay = 15000; // 15 seconds
	private readonly _maxDelay = 300000; // 5 minutes
	private _config: ModuleConfig | null = null;

	private async _fetchMeasurement(
		ip: string,
		token: string
	): Promise<MeasurementResponse | null> {
		try {
			// eslint-disable-next-line no-restricted-globals
			const response = await fetch(`https://${ip}/api/measurement`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${token}`,
				},
				tls: {
					rejectUnauthorized: false,
				},
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const data = (await response.json()) as MeasurementResponse;
			return data;
		} catch (error) {
			warning('Failed to fetch HomeWizard measurement:', error);
			return null;
		}
	}

	private async _poll(): Promise<void> {
		const config = this._config;
		if (!config) {
			return;
		}

		const db = config.db as Database<HomeWizardDB>;
		const dbData = db.current();
		const { ip, token } = dbData;

		if (!ip || !token) {
			return;
		}

		const measurement = await this._fetchMeasurement(ip, token);

		if (measurement) {
			// Success - reset delay to minimum
			this._currentDelay = this._minDelay;

			const energyKwh = measurement.energy_import_kwh ?? 0;
			const powerW = measurement.power_w ?? 0;

			// Update or create device
			let device = this.device.current();
			if (!device) {
				// Fetch device info
				try {
					// eslint-disable-next-line no-restricted-globals
					const infoResponse = await fetch(`https://${ip}/api`, {
						method: 'GET',
						headers: {
							Authorization: `Bearer ${token}`,
						},
						tls: {
							rejectUnauthorized: false,
						},
					});
					const info = (await infoResponse.json()) as {
						product_type?: string;
						serial?: string;
					};
					device = new HomeWizardDevice(
						ip,
						info.product_type ?? 'Unknown',
						info.serial ?? ip.replace(/\./g, '-')
					);
					this.device.set(device);

					(await config.modules.device.api.value).setDevices(
						[device],
						DeviceSource.HOMEWIZARD
					);

					logTag('homewizard', 'green', 'Device initialized:', ip);
				} catch (error) {
					warning('Failed to fetch HomeWizard device info:', error);
					return;
				}
			}

			device.updateMeasurements(energyKwh, powerW);
		} else {
			// Failure - exponential backoff
			this._currentDelay = Math.min(this._currentDelay * 2, this._maxDelay);
			logTag(
				'homewizard',
				'yellow',
				`Polling failed, backing off to ${this._currentDelay / 1000}s`
			);
		}

		// Schedule next poll
		this._scheduleNextPoll();
	}

	private _scheduleNextPoll(): void {
		if (this._pollingInterval) {
			clearTimeout(this._pollingInterval);
		}

		this._pollingInterval = setTimeout(() => {
			void this._poll();
		}, this._currentDelay);
	}

	private _startPolling(): void {
		this._currentDelay = this._minDelay;
		void this._poll();
	}

	private _stopPolling(): void {
		if (this._pollingInterval) {
			clearTimeout(this._pollingInterval);
			this._pollingInterval = null;
		}
	}

	public init(config: ModuleConfig) {
		this._config = config;
		const db = config.db as Database<HomeWizardDB>;

		// Subscribe to config changes
		db.subscribe(async (data) => {
			if (!data?.ip || !data?.token) {
				this._stopPolling();
				const device = this.device.current();
				if (device) {
					device[Symbol.dispose]();
					this.device.set(null);
					(await config.modules.device.api.value).setDevices([], DeviceSource.HOMEWIZARD);
				}
				return;
			}

			// Start or restart polling
			this._stopPolling();
			this._startPolling();
		});

		return {
			serve: initRouting(db),
		};
	}
})();
