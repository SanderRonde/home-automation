import { TuyaThermostatDevice } from './devices/thermostat';
import { logTag, warning } from '../../lib/logging/logger';
import type { Device } from '../device/device';
import type { Database } from '../../lib/db';
import TuyAPI from 'tuyapi';

export interface TuyaDeviceConfig {
	id: string;
	key: string;
	name: string;
	type: 'thermostat';
}

export interface TuyaDB {
	apiKey?: string;
	apiSecret?: string;
	apiRegion?: string;
	devices?: TuyaDeviceConfig[];
}

export class TuyaAPI {
	private readonly _db: Database<TuyaDB>;
	private readonly _devices: Map<string, TuyAPI> = new Map();
	private readonly _tuyaDevices: Map<string, TuyaThermostatDevice> = new Map();
	private readonly _onDevicesChange: (devices: Device[]) => void;

	public constructor(db: Database<TuyaDB>, onDevicesChange: (devices: Device[]) => void) {
		this._db = db;
		this._onDevicesChange = onDevicesChange;
	}

	public async init(): Promise<void> {
		const config = this._db.current();
		if (!config?.devices || config.devices.length === 0) {
			logTag('TUYA', 'yellow', 'No Tuya devices configured');
			return;
		}

		logTag('TUYA', 'blue', `Initializing ${config.devices.length} Tuya device(s)`);

		for (const deviceConfig of config.devices) {
			await this.connectDevice(deviceConfig);
		}

		this.publishDevices();
	}

	private async connectDevice(config: TuyaDeviceConfig): Promise<void> {
		try {
			const device = new TuyAPI({
				id: config.id,
				key: config.key,
				version: '3.3',
			});

			// Find device on network
			await device.find();

			// Connect to device
			await device.connect();

			logTag('TUYA', 'green', `Connected to device: ${config.name}`);

			this._devices.set(config.id, device);

			// Create device wrapper based on type
			if (config.type === 'thermostat') {
				const tuyaDevice = new TuyaThermostatDevice(
					config.name,
					config.id,
					config.key,
					device
				);

				// Listen for device changes
				tuyaDevice.onChange.listen(() => {
					this.publishDevices();
				});

				this._tuyaDevices.set(config.id, tuyaDevice);
			}

			// Handle disconnections
			device.on('disconnected', () => {
				logTag('TUYA', 'red', `Device disconnected: ${config.name}`);
				this._devices.delete(config.id);
				this._tuyaDevices.delete(config.id);
				this.publishDevices();

				// Attempt reconnection after delay
				setTimeout(() => {
					void this.connectDevice(config);
				}, 5000);
			});

			device.on('error', (error: Error) => {
				warning('Tuya device error:', config.name, error.message);
			});
		} catch (error) {
			warning(
				'Failed to connect to Tuya device:',
				config.name,
				error instanceof Error ? error.message : 'Unknown error'
			);
		}
	}

	private publishDevices(): void {
		const devices = Array.from(this._tuyaDevices.values());
		this._onDevicesChange(devices);
	}

	public disconnectAll(): void {
		for (const [id, device] of this._devices.entries()) {
			try {
				device.disconnect();
				logTag('TUYA', 'blue', `Disconnected device: ${id}`);
			} catch (error) {
				warning('Failed to disconnect Tuya device:', id, error);
			}
		}
		this._devices.clear();
		this._tuyaDevices.clear();
		this.publishDevices();
	}

	public async addDevice(config: TuyaDeviceConfig): Promise<void> {
		// Add to database
		const current = this._db.current() || { devices: [] };
		const devices = current.devices || [];
		devices.push(config);
		this._db.set({ ...current, devices });

		// Connect to device
		await this.connectDevice(config);
		this.publishDevices();
	}

	public removeDevice(deviceId: string): void {
		// Disconnect device
		const device = this._devices.get(deviceId);
		if (device) {
			try {
				device.disconnect();
			} catch (error) {
				warning('Failed to disconnect device during removal:', deviceId, error);
			}
			this._devices.delete(deviceId);
			this._tuyaDevices.delete(deviceId);
		}

		// Remove from database
		const current = this._db.current() || { devices: [] };
		const devices = (current.devices || []).filter((d) => d.id !== deviceId);
		this._db.set({ ...current, devices });

		this.publishDevices();
	}

	public async updateDevice(deviceId: string, config: TuyaDeviceConfig): Promise<void> {
		// Remove old device
		this.removeDevice(deviceId);

		// Add new device with updated config
		await this.addDevice(config);
	}

	public async testConnection(config: TuyaDeviceConfig): Promise<boolean> {
		try {
			const device = new TuyAPI({
				id: config.id,
				key: config.key,
				version: '3.3',
			});

			await device.find();
			await device.connect();

			// Get device status to verify connection
			const status = await device.get({ schema: true });
			device.disconnect();

			logTag('TUYA', 'green', `Test connection successful: ${config.name}`);
			return status !== null;
		} catch (error) {
			warning(
				'Test connection failed:',
				config.name,
				error instanceof Error ? error.message : 'Unknown error'
			);
			return false;
		}
	}

	public getDevices(): TuyaDeviceConfig[] {
		const current = this._db.current();
		return current?.devices || [];
	}

	public getCredentials(): { apiKey?: string; apiSecret?: string; apiRegion?: string } {
		const current = this._db.current();
		return {
			apiKey: current?.apiKey,
			apiSecret: current?.apiSecret,
			apiRegion: current?.apiRegion,
		};
	}

	public setCredentials(apiKey: string, apiSecret: string, apiRegion: string): void {
		const current = this._db.current() || { devices: [] };
		this._db.set({
			...current,
			apiKey,
			apiSecret,
			apiRegion,
		});
		logTag('TUYA', 'green', 'Tuya credentials updated');
	}
}
