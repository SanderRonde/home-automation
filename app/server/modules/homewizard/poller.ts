import { logTag } from '../../lib/logging/logger';

const DEFAULT_INTERVAL_MS = 15_000;
const MAX_INTERVAL_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 10_000;

export interface HomeWizardMeasurementPayload {
	energy_import_kwh?: number;
	power_w?: number;
	temperature?: number;
	temperature_c?: number;
	[key: string]: unknown;
}

export interface HomeWizardMeasurement {
	timestamp: number;
	energy_import_kwh?: number | null;
	power_w?: number | null;
	temperature_c?: number | null;
	raw: HomeWizardMeasurementPayload;
}

export interface HomeWizardPollerState {
	nextRunAt: number | null;
	intervalMs: number;
	failureCount: number;
	lastError: string | null;
	active: boolean;
}

interface PollerConfig {
	ip: string;
	token: string;
}

interface PollerCallbacks {
	onMeasurement: (measurement: HomeWizardMeasurement) => Promise<void> | void;
	onError?: (error: Error) => void;
}

export class HomeWizardPoller {
	private _timer: Timer | null = null;
	private _currentInterval = DEFAULT_INTERVAL_MS;
	private _failureCount = 0;
	private _nextRunAt: number | null = null;
	private _lastError: string | null = null;
	private _active = false;
	private _config: PollerConfig | null = null;

	public constructor(config: PollerConfig | null, private readonly _callbacks: PollerCallbacks) {
		this._config = config;
	}

	public start(): void {
		if (!this._config || this._active) {
			return;
		}
		this._active = true;
		this._schedule(0);
	}

	public pause(): void {
		this._active = false;
		if (this._timer) {
			clearTimeout(this._timer);
			this._timer = null;
		}
		this._nextRunAt = null;
	}

	public resume(): void {
		if (!this._config || this._active) {
			return;
		}
		this._active = true;
		this._schedule(0);
	}

	public stop(): void {
		this.pause();
		this._failureCount = 0;
		this._currentInterval = DEFAULT_INTERVAL_MS;
		this._lastError = null;
	}

	public restart(): void {
		this.stop();
		if (this._config) {
			this._active = true;
			this._schedule(0);
		}
	}

	public updateConfig(config: PollerConfig | null): void {
		this._config = config;
		if (!config) {
			this.stop();
			return;
		}
		this.restart();
	}

	public getState(): HomeWizardPollerState {
		return {
			nextRunAt: this._nextRunAt,
			intervalMs: this._currentInterval,
			failureCount: this._failureCount,
			lastError: this._lastError,
			active: this._active,
		};
	}

	private _schedule(delay: number): void {
		if (!this._active) {
			return;
		}
		this._nextRunAt = Date.now() + delay;
		this._timer = setTimeout(() => {
			void this._tick();
		}, delay);
	}

	private async _tick(): Promise<void> {
		if (!this._config) {
			this.pause();
			return;
		}

		try {
			const measurement = await this._fetchMeasurement(this._config);
			this._failureCount = 0;
			this._currentInterval = DEFAULT_INTERVAL_MS;
			this._lastError = null;
			await this._callbacks.onMeasurement(measurement);
		} catch (error) {
			this._failureCount++;
			const nextInterval = Math.min(
				DEFAULT_INTERVAL_MS * 2 ** this._failureCount,
				MAX_INTERVAL_MS
			);
			this._currentInterval = nextInterval;
			const err =
				error instanceof Error
					? error
					: new Error(typeof error === 'string' ? error : 'Unknown error');
			this._lastError = err.message;
			logTag('homewizard', 'yellow', 'Measurement failed:', err.message);
			this._callbacks.onError?.(err);
		} finally {
			if (this._active) {
				this._schedule(this._currentInterval);
			}
		}
	}

	private async _fetchMeasurement(config: PollerConfig): Promise<HomeWizardMeasurement> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
		const baseUrl = config.ip.startsWith('http') ? config.ip : `http://${config.ip}`;
		try {
			const response = await fetch(`${baseUrl}/api/measurement`, {
				headers: {
					Authorization: `Bearer ${config.token}`,
					Accept: 'application/json',
				},
				signal: controller.signal,
			});

			if (!response.ok) {
				throw new Error(`HomeWizard API responded with ${response.status}`);
			}

			const payload = (await response.json()) as HomeWizardMeasurementPayload;
			const timestamp = Date.now();
			return {
				timestamp,
				energy_import_kwh: this._toNumber(payload.energy_import_kwh),
				power_w: this._toNumber(payload.power_w),
				temperature_c: this._extractTemperature(payload),
				raw: payload,
			};
		} finally {
			clearTimeout(timeout);
		}
	}

	private _toNumber(value: unknown): number | null {
		if (typeof value === 'number') {
			return Number.isNaN(value) ? null : value;
		}
		if (typeof value === 'string') {
			const parsed = Number(value);
			return Number.isNaN(parsed) ? null : parsed;
		}
		return null;
	}

	private _extractTemperature(payload: HomeWizardMeasurementPayload): number | null {
		if (typeof payload.temperature_c === 'number') {
			return this._toNumber(payload.temperature_c);
		}
		if (typeof payload.temperature === 'number') {
			return this._toNumber(payload.temperature);
		}
		return null;
	}
}
