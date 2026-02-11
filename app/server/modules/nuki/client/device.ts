import { DeviceDoorLockCluster, LockState, type DeviceClusterName } from '../../device/cluster';
import { DeviceEndpoint, DeviceSource, type Device } from '../../device/device';
import { NukiDoorLockCluster, nukiStateToLockState } from './cluster';
import { EventEmitter } from '../../../lib/event-emitter';
import type { NukiSmartlockListItem } from '../types';
import type { NukiAPIClient } from './api';
import { Data } from '../../../lib/data';

export class NukiSmartlockDevice extends DeviceEndpoint implements Device {
	public readonly onChange = new EventEmitter<void>();
	public readonly clusters: NukiDoorLockCluster[];
	private readonly _lockStateData: Data<LockState | undefined>;

	public constructor(
		private readonly _api: NukiAPIClient,
		private readonly _smartlockId: number,
		private readonly _name: string,
		private readonly _batteryCritical: boolean
	) {
		super();
		this._lockStateData = new Data<LockState | undefined>(undefined);
		const cluster = new NukiDoorLockCluster(this._lockStateData, _api, _smartlockId, true);
		cluster.onChange.listen(() => this.onChange.emit(undefined));
		this.clusters = [cluster];
	}

	public get endpoints(): DeviceEndpoint[] {
		return [];
	}

	public getUniqueId(): string {
		return `nuki-smartlock-${this._smartlockId}`;
	}

	public getSource(): DeviceSource {
		return DeviceSource.NUKI;
	}

	public getDeviceName(): Promise<string> {
		return Promise.resolve(this._name);
	}

	/** Sync name for config/device list. */
	public getName(): string {
		return this._name;
	}

	public getManagementUrl(): Promise<string | undefined> {
		return Promise.resolve(`https://web.nuki.io/#/smartlock/${this._smartlockId}`);
	}

	public getDeviceStatus(): 'online' | 'offline' {
		return this._batteryCritical ? 'offline' : 'online';
	}

	/** Refresh lock state from API. Called by module on poll. */
	public async refresh(): Promise<void> {
		try {
			const details = await this._api.getSmartlock(this._smartlockId);
			const state = nukiStateToLockState(
				details.state as Parameters<typeof nukiStateToLockState>[0]
			);
			this._lockStateData.set(state);
		} catch {
			// Keep previous state on error
		}
	}

	public [Symbol.dispose](): void {
		for (const cluster of this.clusters) {
			cluster[Symbol.dispose]();
		}
	}
}

/** Opener device: door opener (ring/open). Exposes door lock cluster where unlock = open. */
export class NukiOpenerDevice extends DeviceEndpoint implements Device {
	public readonly onChange = new EventEmitter<void>();
	public readonly clusters: DeviceDoorLockCluster[];
	private readonly _lockStateData: Data<LockState | undefined>;

	public constructor(
		api: NukiAPIClient,
		private readonly _openerId: number,
		private readonly _name: string
	) {
		super();
		this._lockStateData = new Data<LockState | undefined>(LockState.Unlocked);
		// Opener cluster: only "unlock" (open) is meaningful; we use a minimal adapter
		const cluster = new NukiOpenerDoorLockCluster(this._lockStateData, api, _openerId);
		cluster.onChange.listen(() => this.onChange.emit(undefined));
		this.clusters = [cluster];
	}

	public get endpoints(): DeviceEndpoint[] {
		return [];
	}

	public getUniqueId(): string {
		return `nuki-opener-${this._openerId}`;
	}

	public getSource(): DeviceSource {
		return DeviceSource.NUKI;
	}

	public getDeviceName(): Promise<string> {
		return Promise.resolve(this._name);
	}

	/** Sync name for config/device list. */
	public getName(): string {
		return this._name;
	}

	public getManagementUrl(): Promise<string | undefined> {
		return Promise.resolve(`https://web.nuki.io/#/opener/${this._openerId}`);
	}

	public getDeviceStatus(): 'online' | 'offline' {
		return 'online';
	}

	public async refresh(): Promise<void> {
		// Opener state not mapped to lock state; no-op
	}

	public [Symbol.dispose](): void {
		for (const cluster of this.clusters) {
			cluster[Symbol.dispose]();
		}
	}
}

/** Door lock cluster for opener: unlockDoor triggers open. */
class NukiOpenerDoorLockCluster extends DeviceDoorLockCluster {
	public readonly onChange = new EventEmitter<void>();

	public constructor(
		public readonly lockState: Data<LockState | undefined>,
		private readonly _api: NukiAPIClient,
		private readonly _openerId: number
	) {
		super();
		lockState.subscribe(() => this.onChange.emit(undefined));
	}

	public getBaseCluster(): typeof DeviceDoorLockCluster & {
		clusterName: DeviceClusterName;
	} {
		return DeviceDoorLockCluster as unknown as typeof DeviceDoorLockCluster & {
			clusterName: DeviceClusterName;
		};
	}

	public async lockDoor(): Promise<void> {
		// No-op for opener
	}

	public async unlockDoor(): Promise<void> {
		await this._api.openerOpen(this._openerId);
		this.onChange.emit(undefined);
	}

	public async toggle(): Promise<void> {
		await this.unlockDoor();
	}

	public [Symbol.dispose](): void {}
}

export function createSmartlockDevice(
	api: NukiAPIClient,
	item: NukiSmartlockListItem
): NukiSmartlockDevice {
	const batteryCritical =
		item.config?.batteryCritical ?? item.config?.keypadBatteryCritical ?? false;
	return new NukiSmartlockDevice(api, item.smartlockId, item.name, batteryCritical);
}

/** Openers come from GET /smartlock?type=2 (same shape as smartlock, use smartlockId). */
export function createOpenerDevice(
	api: NukiAPIClient,
	item: NukiSmartlockListItem
): NukiOpenerDevice {
	return new NukiOpenerDevice(api, item.smartlockId, item.name);
}
