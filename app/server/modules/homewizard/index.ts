import { Data } from '../../lib/data';
import type { ModuleConfig, AllModules } from '..';
import type { Database } from '../../lib/db';
import { warning } from '../../lib/logging/logger';
import { ModuleMeta } from '../meta';
import type { SQL } from 'bun';
import { DeviceSource } from '../device/device';
import { HomeWizardDevice } from './device';
import { HomeWizardPoller, type HomeWizardMeasurement } from './poller';
import type { Device } from '../device/device';
import { DeviceElectricalPowerMeasurementCluster } from '../device/cluster';
import { initRouting } from './routing';
import type { HistoryEntry, MeasurementSource, MeasurementSummary } from './types';

export interface HomeWizardDB {
	ip?: string;
	apiToken?: string;
}

interface AggregateCache {
	timestamp: number;
	value: number | null;
}

const HISTORY_LIMIT_MAX = 5000;
const AGGREGATE_CACHE_TTL_MS = 10_000;

export const HomeWizard = new (class HomeWizardModule extends ModuleMeta {
	public name = 'homewizard';

	private _db!: Database<HomeWizardDB>;
	private _sql!: SQL;
	private _device: HomeWizardDevice | null = null;
	private _deviceIp: string | null = null;
	private _moduleConfig: ModuleConfig | null = null;

	private readonly _totalEnergyData = new Data<bigint>(0n);
	private readonly _energyPeriodData = new Data<{ from: Date; to: Date } | undefined>(undefined);
	private readonly _activePowerData = new Data<number | undefined>(undefined);

	private _latestMeasurement: MeasurementSummary | null = null;
	private _aggregateCache: AggregateCache | null = null;

	private readonly _poller = new HomeWizardPoller(null, {
		onMeasurement: async (measurement) => {
			await this._handleMeasurement(measurement);
		},
		onError: (error) => {
			warning('HomeWizard measurement failed', error);
		},
	});

	public async init(config: ModuleConfig) {
		this._moduleConfig = config;
		this._db = config.db as Database<HomeWizardDB>;
		this._sql = await this._sqlDB.value;
		await this._ensureTables();
		await this._loadLatestMeasurementFromDb();

		this._db.subscribe((data) => {
			void this._handleConfigChange(data, config);
		});
		await this._handleConfigChange(this._db.current(), config);

		return {
			serve: initRouting(config, this),
		};
	}

	public override onOffline(): void {
		this._poller.pause();
	}

	public override onBackOnline(): void {
		this._poller.resume();
	}

	public isConfigured(): boolean {
		const current = this._db.current();
		return Boolean(current.ip && current.apiToken);
	}

	public getStatus() {
		const dbState = this._db.current();
		return {
			configured: this.isConfigured(),
			ip: dbState.ip ?? '',
			hasToken: Boolean(dbState.apiToken),
			lastMeasurement: this._latestMeasurement,
			instructions: this._getInstructions(),
			docsUrl: 'https://api-documentation.homewizard.com/docs/category/api-v2',
			poller: this._poller.getState(),
		};
	}

	public async getLatestMeasurementSummary(): Promise<MeasurementSummary> {
		if (this._latestMeasurement) {
			return this._latestMeasurement;
		}
		return await this._getAggregatedMeasurementSummary();
	}

	public async getMeasurementHistory(
		timeframeMs: number
	): Promise<{ mode: MeasurementSource; history: HistoryEntry[]; latest: MeasurementSummary }> {
		const limit = Math.min(
			Math.ceil(timeframeMs / 15_000) + 10,
			HISTORY_LIMIT_MAX
		);

		if (this.isConfigured()) {
			const history = await this._getHomeWizardHistory(timeframeMs, limit);
			const latest = this._latestMeasurement ?? (await this._loadLatestMeasurementFromDb());
			if (history.length || latest) {
				return {
					mode: 'homewizard',
					history,
					latest: latest ?? (await this._getAggregatedMeasurementSummary()),
				};
			}
		}

		const fallback = await this._getAggregatedHistory(timeframeMs, limit);
		const fallbackLatest = await this._getAggregatedMeasurementSummary();
		return {
			mode: 'aggregated',
			history: fallback,
			latest: fallbackLatest,
		};
	}

	public async updateConfig(ip: string, apiToken: string): Promise<void> {
		const sanitizedIp = this._sanitizeIp(ip);
		this._db.update((old) => ({
			...old,
			ip: sanitizedIp,
			apiToken: apiToken.trim(),
		}));
	}

	private async _handleConfigChange(data: Partial<HomeWizardDB> | undefined, config: ModuleConfig) {
		const ip = data?.ip ? this._sanitizeIp(data.ip) : undefined;
		const token = data?.apiToken?.trim();

		if (!ip || !token) {
			this._poller.updateConfig(null);
			await this._setDevice(null);
			return;
		}

		this._poller.updateConfig({ ip, token });
		this._poller.start();
		await this._setDevice(ip);
	}

	private async _setDevice(ip: string | null) {
		const modules = this._moduleConfig?.modules;
		if (!modules) {
			return;
		}
		const deviceApi = await modules.device.api.value;

		if (!ip) {
			this._device?.[Symbol.dispose]?.();
			this._device = null;
			this._deviceIp = null;
			deviceApi.setDevices([], DeviceSource.HOMEWIZARD);
			return;
		}

		if (this._device && this._deviceIp === ip) {
			deviceApi.setDevices([this._device], DeviceSource.HOMEWIZARD);
			return;
		}

		this._device?.[Symbol.dispose]?.();
		this._device = new HomeWizardDevice({
			ip,
			energy: this._totalEnergyData,
			energyPeriod: this._energyPeriodData,
			power: this._activePowerData,
		});
		this._deviceIp = ip;
		deviceApi.setDevices([this._device], DeviceSource.HOMEWIZARD);
	}

	private async _handleMeasurement(measurement: HomeWizardMeasurement): Promise<void> {
		const summary: MeasurementSummary = {
			timestamp: measurement.timestamp,
			powerW: measurement.power_w ?? null,
			energyImportKwh: measurement.energy_import_kwh ?? null,
			temperatureC: measurement.temperature_c ?? null,
			source: 'homewizard',
		};
		this._latestMeasurement = summary;
		this._aggregateCache = null;

		if (measurement.energy_import_kwh !== null && measurement.energy_import_kwh !== undefined) {
			const wattHours = BigInt(Math.round(measurement.energy_import_kwh * 1000));
			this._totalEnergyData.set(wattHours);
		}
		if (measurement.power_w !== null && measurement.power_w !== undefined) {
			this._activePowerData.set(measurement.power_w);
		} else {
			this._activePowerData.set(undefined);
		}

		await this._insertMeasurement(summary);
	}

	private async _insertMeasurement(summary: MeasurementSummary): Promise<void> {
		try {
			await this._sql`
				INSERT INTO homewizard_measurements (timestamp, source, power_w, energy_import_kwh, temperature_c)
				VALUES (${summary.timestamp ?? Date.now()}, ${summary.source}, ${summary.powerW}, ${summary.energyImportKwh}, ${summary.temperatureC})
			`;
		} catch (error) {
			warning('Failed to store HomeWizard measurement', error);
		}
	}

	private async _ensureTables(): Promise<void> {
		await this._sql`
			CREATE TABLE IF NOT EXISTS homewizard_measurements (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				timestamp INTEGER NOT NULL,
				source TEXT NOT NULL,
				power_w REAL,
				energy_import_kwh REAL,
				temperature_c REAL
			)
		`;
		await this._sql`
			CREATE INDEX IF NOT EXISTS idx_homewizard_measurements_timestamp
			ON homewizard_measurements(timestamp DESC)
		`;
	}

	private async _loadLatestMeasurementFromDb(): Promise<MeasurementSummary | null> {
		try {
			const row = await this._sql<[{ timestamp: number; power_w: number | null; energy_import_kwh: number | null; temperature_c: number | null }?]>`
				SELECT timestamp, power_w, energy_import_kwh, temperature_c
				FROM homewizard_measurements
				ORDER BY timestamp DESC
				LIMIT 1
			`;
			if (row && row[0]) {
				const summary: MeasurementSummary = {
					timestamp: row[0].timestamp,
					powerW: row[0].power_w,
					energyImportKwh: row[0].energy_import_kwh,
					temperatureC: row[0].temperature_c,
					source: 'homewizard',
				};
				this._latestMeasurement = summary;
				if (row[0].energy_import_kwh !== null && row[0].energy_import_kwh !== undefined) {
					const wattHours = BigInt(Math.round(row[0].energy_import_kwh * 1000));
					this._totalEnergyData.set(wattHours);
				}
				if (row[0].power_w !== null && row[0].power_w !== undefined) {
					this._activePowerData.set(row[0].power_w);
				}
				return summary;
			}
		} catch (error) {
			warning('Failed to load latest HomeWizard measurement', error);
		}
		return null;
	}

	private async _getHomeWizardHistory(timeframeMs: number, limit: number): Promise<HistoryEntry[]> {
		try {
			const since = Date.now() - timeframeMs;
			const rows = await this._sql<
				Array<{
					timestamp: number;
					power_w: number | null;
					energy_import_kwh: number | null;
				}>
			>`
				SELECT timestamp, power_w, energy_import_kwh
				FROM homewizard_measurements
				WHERE timestamp >= ${since}
				ORDER BY timestamp DESC
				LIMIT ${limit}
			`;
			return rows.reverse().map((row) => ({
				timestamp: row.timestamp,
				powerW: row.power_w,
				energyImportKwh: row.energy_import_kwh,
			}));
		} catch (error) {
			warning('Failed to load HomeWizard history', error);
			return [];
		}
	}

	private async _getAggregatedHistory(
		timeframeMs: number,
		limit: number
	): Promise<HistoryEntry[]> {
		try {
			const since = Date.now() - timeframeMs;
			const rows = await this._sql<
				Array<{
					timestamp: number;
					total_power: number | null;
				}>
			>`
				SELECT timestamp, SUM(active_power) as total_power
				FROM power_events
				WHERE timestamp >= ${since}
				GROUP BY timestamp
				ORDER BY timestamp DESC
				LIMIT ${limit}
			`;
			return rows.reverse().map((row) => ({
				timestamp: row.timestamp,
				powerW: row.total_power,
				energyImportKwh: null,
			}));
		} catch {
			return [];
		}
	}

	private async _getAggregatedMeasurementSummary(): Promise<MeasurementSummary> {
		const aggregate = await this._getAggregatePowerFromDevices();
		return {
			timestamp: aggregate.timestamp,
			powerW: aggregate.value,
			energyImportKwh: null,
			temperatureC: null,
			source: 'aggregated',
		};
	}

	private async _getAggregatePowerFromDevices(): Promise<{ value: number | null; timestamp: number | null }> {
		if (this._aggregateCache && Date.now() - this._aggregateCache.timestamp < AGGREGATE_CACHE_TTL_MS) {
			return { value: this._aggregateCache.value, timestamp: this._aggregateCache.timestamp };
		}

		try {
			const modules = await this.getModules<AllModules>();
			const deviceApi = await modules.device.api.value;
			const devices = Object.values(deviceApi.devices.current());
			const powerPromises: Array<Promise<number | undefined>> = [];

			for (const device of devices) {
				const clusters = (device as Device).getAllClustersByType(
					DeviceElectricalPowerMeasurementCluster
				);
				for (const cluster of clusters) {
					powerPromises.push(cluster.activePower.get());
				}
			}

			const results = await Promise.all(powerPromises);
			let total = 0;
			let hasValue = false;
			for (const value of results) {
				if (typeof value === 'number' && !Number.isNaN(value)) {
					total += value;
					hasValue = true;
				}
			}
			const finalValue = hasValue ? total : null;
			this._aggregateCache = {
				timestamp: Date.now(),
				value: finalValue,
			};
			return { value: finalValue, timestamp: this._aggregateCache.timestamp };
		} catch (error) {
			warning('Failed to compute aggregated power usage', error);
			return { value: null, timestamp: Date.now() };
		}
	}

	private _sanitizeIp(ip: string): string {
		return ip.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
	}

	private _getInstructions(): string[] {
		return [
			'Open the HomeWizard Energy app and go to Settings → Wi-Fi → Local API.',
			'Enable the Local API toggle and copy the generated API token.',
			'Find the device IP address in Settings → Devices → [Your Device] → Wi-Fi details.',
			'Enter the IP and token below, then save to start syncing measurements.',
		];
	}
})();
