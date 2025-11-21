import { logTag } from '../../lib/logging/logger';
import { asyncSetInterval } from '../../lib/time';
import { TuyaDevice } from './client/device';
import type { Database } from '../../lib/db';
import { Data } from '../../lib/data';
import type { TuyaDB } from '.';

const TuyAPI = require('tuyapi');

export interface TuyaDeviceConfig {
	id: string;
	key: string;
	ip: string;
	version: string;
	role?: 'master' | 'slave';
}

export class TuyaAPI implements Disposable {
	private _disposables: Set<() => void> = new Set();
	private _devices: TuyaDevice[] = [];
	private _tuyaDevices: Map<string, typeof TuyAPI> = new Map();

	public get devices(): TuyaDevice[] {
		return this._devices;
	}

	public constructor(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		private readonly _db: Database<TuyaDB>,
		private readonly _onDevices: (devices: TuyaDevice[]) => void
	) {}

	public async init(deviceConfigs: Record<string, TuyaDeviceConfig>): Promise<this> {
		await this.initTuyaDevices(deviceConfigs);
		return this;
	}

	private async initTuyaDevices(deviceConfigs: Record<string, TuyaDeviceConfig>) {
		const devices: TuyaDevice[] = [];

		for (const [deviceId, config] of Object.entries(deviceConfigs)) {
			try {
				const tuyaDevice = new TuyAPI({
					id: config.id,
					key: config.key,
					ip: config.ip,
					version: config.version,
				});

				this._tuyaDevices.set(deviceId, tuyaDevice);

				// Connect to device
				await tuyaDevice.find();
				await tuyaDevice.connect();

				const stateData = new Data<Record<string, unknown> | undefined>(undefined);

				// Listen for data updates
				tuyaDevice.on('data', (data: Record<string, unknown>) => {
					stateData.set(data);
				});

				tuyaDevice.on('error', (error: Error) => {
					logTag('tuya', 'red', `Device ${deviceId} error:`, error.message);
				});

				tuyaDevice.on('connected', () => {
					logTag('tuya', 'blue', `Device ${deviceId} connected`);
				});

				tuyaDevice.on('disconnected', () => {
					logTag('tuya', 'yellow', `Device ${deviceId} disconnected`);
					// Attempt reconnection after a delay
					setTimeout(() => {
						tuyaDevice.connect().catch((e: Error) => {
							logTag('tuya', 'red', `Failed to reconnect device ${deviceId}:`, e.message);
						});
					}, 5000);
				});

				// Get initial state
				const initialState = await tuyaDevice.get();
				stateData.set(initialState);

				const device = TuyaDevice.from(deviceId, config, tuyaDevice, stateData);
				if (device) {
					devices.push(device);
					logTag('tuya', 'blue', `Initialized device ${deviceId}`);
				}
			} catch (e) {
				logTag(
					'tuya',
					'red',
					`Failed to initialize device ${deviceId}: ${e instanceof Error ? e.message : 'Unknown error'}`
				);
			}
		}

		this._devices = devices;
		this._onDevices(devices);

		// Poll devices periodically for state updates
		const interval = asyncSetInterval(
			async () => {
				for (const [deviceId, tuyaDevice] of this._tuyaDevices) {
					try {
						await tuyaDevice.get();
					} catch (e) {
						logTag(
							'tuya',
							'yellow',
							`Failed to poll device ${deviceId}: ${e instanceof Error ? e.message : 'Unknown error'}`
						);
					}
				}
			},
			1000 * 30 // Poll every 30 seconds
		);
		this._disposables.add(() => clearInterval(interval));

		logTag('tuya', 'blue', 'API connection established');
	}

	public [Symbol.dispose](): void {
		// Disconnect all devices
		for (const tuyaDevice of this._tuyaDevices.values()) {
			try {
				tuyaDevice.disconnect();
			} catch {
				// Ignore errors during disposal
			}
		}
		this._disposables.forEach((disposable) => disposable());
	}

	public async setDeviceState(deviceId: string, dps: Record<string, unknown>): Promise<boolean> {
		const device = this._tuyaDevices.get(deviceId);
		if (!device) {
			logTag('tuya', 'red', `Device ${deviceId} not found`);
			return false;
		}

		try {
			await device.set({ multiple: true, data: dps });
			return true;
		} catch (e) {
			logTag(
				'tuya',
				'red',
				`Failed to set state for device ${deviceId}: ${e instanceof Error ? e.message : 'Unknown error'}`
			);
			return false;
		}
	}
}
