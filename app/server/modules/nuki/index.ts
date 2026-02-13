import {
	createSmartlockDevice,
	createOpenerDevice,
	NukiSmartlockDevice,
	NukiOpenerDevice,
} from './client/device';
import { logTag } from '../../lib/logging/logger';
import { DeviceSource } from '../device/device';
import type { NukiDeviceInfo } from './routing';
import { NukiAPIClient } from './client/api';
import type { Database } from '../../lib/db';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import type { NukiDB } from './types';
import { ModuleMeta } from '../meta';

const POLL_INTERVAL_MS = 45_000;

export const Nuki = new (class Nuki extends ModuleMeta {
	public name = 'nuki';

	private _devices: Map<string, NukiSmartlockDevice | NukiOpenerDevice> = new Map();
	private _pollTimer: ReturnType<typeof setInterval> | null = null;

	private getDevicesList(): NukiDeviceInfo[] {
		return Array.from(this._devices.entries()).map(([id, d]) => ({
			id,
			name: d.getName(),
			type: d.getUniqueId().startsWith('nuki-opener-')
				? ('opener' as const)
				: ('smartlock' as const),
		}));
	}

	private async refreshAllDevices(): Promise<void> {
		for (const device of this._devices.values()) {
			try {
				await device.refresh();
			} catch {
				// Keep previous state
			}
		}
	}

	private stopPolling(): void {
		if (this._pollTimer !== null) {
			clearInterval(this._pollTimer);
			this._pollTimer = null;
		}
	}

	private startPolling(): void {
		this.stopPolling();
		this._pollTimer = setInterval(() => {
			void this.refreshAllDevices();
		}, POLL_INTERVAL_MS);
	}

	private async fetchAndRegisterDevices(config: ModuleConfig): Promise<void> {
		const db = config.db as Database<NukiDB>;
		const token = db.current().apiToken;
		if (!token) {
			this._devices.clear();
			this.stopPolling();
			(await config.modules.device.api.value).setDevices([], DeviceSource.NUKI);
			return;
		}
		const api = new NukiAPIClient(token);
		const devices: (NukiSmartlockDevice | NukiOpenerDevice)[] = [];
		try {
			const [smartlocks, openers] = await Promise.all([
				api.getSmartlocks(),
				api.getOpeners(),
			]);
			const newMap = new Map<string, NukiSmartlockDevice | NukiOpenerDevice>();
			for (const item of smartlocks) {
				const existing = this._devices.get(`nuki-smartlock-${item.smartlockId}`);
				const device =
					existing && existing instanceof NukiSmartlockDevice
						? existing
						: createSmartlockDevice(api, item);
				newMap.set(device.getUniqueId(), device);
				devices.push(device);
			}
			for (const item of openers) {
				const existing = this._devices.get(`nuki-opener-${item.smartlockId}`);
				const device =
					existing && existing instanceof NukiOpenerDevice
						? existing
						: createOpenerDevice(api, item);
				newMap.set(device.getUniqueId(), device);
				devices.push(device);
			}
			this._devices = newMap;
			await this.refreshAllDevices();
			this.startPolling();
			(await config.modules.device.api.value).setDevices(devices, DeviceSource.NUKI);
			logTag('nuki', 'green', `Registered ${devices.length} Nuki device(s)`);
		} catch (err) {
			logTag('nuki', 'red', 'Failed to fetch Nuki devices:', err);
			this._devices.clear();
			this.stopPolling();
			(await config.modules.device.api.value).setDevices([], DeviceSource.NUKI);
		}
	}

	public init(config: ModuleConfig): { serve: ReturnType<typeof initRouting> } {
		const db = config.db as Database<NukiDB>;
		db.subscribe(() => {
			void this.fetchAndRegisterDevices(config);
		});
		logTag('nuki', 'green', 'Nuki module initialized');
		return {
			serve: initRouting(db, () => this.getDevicesList()),
		};
	}
})();
