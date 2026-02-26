import { DeviceClusterName, DeviceOnOffCluster } from '../../device/cluster';
import { EventEmitter } from '../../../lib/event-emitter';
import { Data, MappedData } from '../../../lib/data';
import type { Cluster } from '../../device/cluster';

class MatterLikeState<S> implements Disposable {
	public onChange: EventEmitter<void> = new EventEmitter();
	private _disposables: (() => void)[] = [];

	public constructor(ip: string, clusterName: DeviceClusterName) {
		this.fetchState(ip, clusterName);
		const interval = setInterval(() => {
			this.fetchState(ip, clusterName);
		}, 30 * 1000);
		this._disposables.push(() => clearInterval(interval));
	}

	private async fetchState(ip: string, clusterName: DeviceClusterName) {
		let lastData: S | undefined = undefined;
		// eslint-disable-next-line no-restricted-globals
		await fetch(`${ip}/clusters`).then((response) => {
			response.json().then((data) => {
				if (JSON.stringify(data) !== JSON.stringify(lastData)) {
					lastData = data;
					this.state.set(data.clusters[clusterName]);
					this.onChange.emit(undefined);
				}
			});
		});
	}

	public state = new Data<S | undefined>(undefined);

	public async clusterAction(ip: string, clusterName: DeviceClusterName, actionName: string) {
		// For now no args
		// eslint-disable-next-line no-restricted-globals
		await fetch(`${ip}/clusters`, {
			method: 'POST',
			body: JSON.stringify({
				cluster: clusterName,
				action: actionName,
			}),
		});
		await this.fetchState(ip, clusterName);
	}

	public [Symbol.dispose](): void {
		this._disposables.forEach((dispose) => dispose());
		this._disposables.length = 0;
	}
}

export class MatterLikeOnOffCluster implements DeviceOnOffCluster {
	public onChange = new EventEmitter<void>();
	private _state: MatterLikeState<{ isOn: boolean }>;

	public constructor(private readonly ip: string) {
		this._state = new MatterLikeState<{ isOn: boolean }>(this.ip, DeviceClusterName.ON_OFF);
		this._state.onChange.listen(() => {
			this.onChange.emit(undefined);
		});
		this.isOn = new MappedData(this._state.state, (state) => {
			return state?.isOn ?? false;
		});
		this.isOn.subscribe(() => {
			this.onChange.emit(undefined);
		});
	}

	public isOn: Data<boolean>;

	public getBaseCluster(): typeof DeviceOnOffCluster {
		return DeviceOnOffCluster;
	}

	public setOn = async (on: boolean): Promise<void> => {
		await this._state.clusterAction(this.ip, DeviceClusterName.ON_OFF, on ? 'on' : 'off');
	};

	public toggle = async (): Promise<void> => {
		await this._state.clusterAction(this.ip, DeviceClusterName.ON_OFF, 'toggle');
	};

	public [Symbol.dispose](): void {
		this._state[Symbol.dispose]();
	}
}

export const matterLikeClusters: Partial<
	Record<DeviceClusterName, new (...args: unknown[]) => Cluster>
> = {
	[DeviceClusterName.ON_OFF]: MatterLikeOnOffCluster,
};
