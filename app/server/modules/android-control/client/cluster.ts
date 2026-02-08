import { DeviceLevelControlCluster, DeviceOnOffCluster } from '../../device/cluster';
import { EventEmitter } from '../../../lib/event-emitter';
import { Data, MappedData } from '../../../lib/data';

export class AndroidControlOnOffCluster implements DeviceOnOffCluster {
	public constructor(private readonly state: Data<{ isOn: boolean }>) {
		this.isOn = new MappedData(state, (s) => s.isOn);
	}

	public onChange = new EventEmitter<void>();

	public getBaseCluster(): typeof DeviceOnOffCluster {
		return DeviceOnOffCluster;
	}

	public isOn: Data<boolean>;

	public async setOn(on: boolean): Promise<void> {
		this.state.set({ ...this.state.current(), isOn: on });
	}

	public async toggle(): Promise<void> {
		const current = this.state.current().isOn;
		await this.setOn(!current);
	}

	public [Symbol.dispose](): void {}
}

export class AndroidControlLevelControlCluster implements DeviceLevelControlCluster {
	public constructor(
		private readonly state: Data<{ level: number; step: number; name: string }>
	) {
		this.currentLevel = new MappedData(state, (s) => s.level);
		this.step = new MappedData(state, (s) => s.step);
		this.startupLevel = new Data(0);
		this.name = new MappedData(state, (s) => s.name);
	}

	public onChange = new EventEmitter<void>();

	public getBaseCluster(): typeof DeviceLevelControlCluster {
		return DeviceLevelControlCluster;
	}

	public name: Data<string>;

	public currentLevel: Data<number>;
	/** No-op */
	public startupLevel: Data<number>;
	public step: Data<number>;

	public async setLevel(args: { level: number; transitionTimeDs?: number }): Promise<void> {
		this.state.set({ ...this.state.current(), level: args.level });
	}

	public setStartupLevel(): Promise<void> {
		throw new Error('Not implemented');
	}

	public stop(): Promise<void> {
		return Promise.resolve();
	}

	public [Symbol.dispose](): void {}
}
