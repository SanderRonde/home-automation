import { DeviceDoorLockCluster, LockState, type DeviceClusterName } from '../../device/cluster';
import { EventEmitter } from '../../../lib/event-emitter';
import type { Data } from '../../../lib/data';
import type { NukiLockState } from '../types';
import type { NukiAPIClient } from './api';

/** Map Nuki API lock state to Matter LockState. */
export function nukiStateToLockState(state: NukiLockState): LockState {
	switch (state) {
		case 1:
		case 5:
			// 1 = locked, 5 = locked (lock 'n' go)
			return LockState.Locked;
		case 2:
		case 3:
		case 6:
			return LockState.Unlocked;
		case 4:
			return LockState.Unlatched;
		case 0:
		case 255:
		default:
			return LockState.NotFullyLocked;
	}
}

export class NukiDoorLockCluster extends DeviceDoorLockCluster {
	public readonly onChange = new EventEmitter<void>();

	public constructor(
		public readonly lockState: Data<LockState | undefined>,
		private readonly _api: NukiAPIClient,
		private readonly _smartlockId: number,
		private readonly _supportsUnlatch: boolean
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
		await this._api.lock(this._smartlockId);
		this.lockState.set(LockState.Locked);
		this.onChange.emit(undefined);
	}

	public async unlockDoor(): Promise<void> {
		await this._api.unlock(this._smartlockId);
		this.lockState.set(LockState.Unlocked);
		this.onChange.emit(undefined);
	}

	public async toggle(): Promise<void> {
		const current = this.lockState.current();
		if (current === LockState.Locked || current === LockState.NotFullyLocked) {
			await this.unlockDoor();
		} else {
			await this.lockDoor();
		}
	}

	public async unlatchDoor(): Promise<void> {
		if (!this._supportsUnlatch) {
			await this.unlockDoor();
			return;
		}
		await this._api.unlatch(this._smartlockId);
		this.lockState.set(LockState.Unlatched);
		this.onChange.emit(undefined);
	}

	public [Symbol.dispose](): void {}
}
