import {
	DeviceColorControlCluster,
	DeviceLevelControlCluster,
	DeviceOnOffCluster,
} from '../../device/cluster';
import type { WLEDClient, WLEDClientState } from 'wled-client';
import type { DeviceClusterName } from '../../device/cluster';
import { EventEmitter } from '../../../lib/event-emitter';
import { Data, MappedData } from '../../../lib/data';
import type { Mapper } from '../../../lib/data';
import { Color } from '../../../lib/color';

class WLEDState extends Data<WLEDClientState> {
	public constructor(client: WLEDClient) {
		super(client.state);
	}
}

class WLEDMapper<M> extends MappedData<M, WLEDClientState> {
	public constructor(
		self: {
			proxy: WLEDProxy;
			onChange: EventEmitter<void>;
		},
		mapper: Mapper<WLEDClientState, M>,
		alwaysTrack?: boolean
	) {
		super(self.proxy.state, mapper, alwaysTrack);
		this.subscribe((_value, isInitial) => {
			if (!isInitial) {
				return self.onChange.emit(undefined);
			}
		});
	}
}

class WLEDProxy implements Disposable {
	public state: WLEDState;

	public constructor(private readonly _client: WLEDClient) {
		this._client = _client;
		this.state = new WLEDState(this._client);
		this._client.on('update:state', this._stateChange);
		this._client.on('update:context', this._stateChange);
		this._client.on('update:effects', this._stateChange);
		this._client.on('update:palettes', this._stateChange);
		this._client.on('update:presets', this._stateChange);
		this._client.on('update:config', this._stateChange);
		this._client.on('update:info', this._stateChange);
	}

	private readonly _stateChange = () => {
		this.state.set(this._client.state);
	};

	public [Symbol.dispose](): void {
		this._client.off('update:state', this._stateChange);
		this._client.off('update:context', this._stateChange);
		this._client.off('update:effects', this._stateChange);
		this._client.off('update:palettes', this._stateChange);
		this._client.off('update:presets', this._stateChange);
		this._client.off('update:config', this._stateChange);
		this._client.off('update:info', this._stateChange);
	}
}

class ConfigurableCluster {
	public proxy: WLEDProxy;
	public onChange: EventEmitter<void> = new EventEmitter();

	public constructor(public readonly client: WLEDClient) {
		this.proxy = new WLEDProxy(client);
	}

	public [Symbol.dispose](): void {
		this.proxy[Symbol.dispose]();
	}
}

export class WLEDOnOffCluster extends ConfigurableCluster implements DeviceOnOffCluster {
	public isOn = new WLEDMapper(this, (state) => state?.on ?? false);

	public getName(): DeviceClusterName {
		return DeviceOnOffCluster.clusterName;
	}

	public setOn = async (on: boolean): Promise<void> => {
		if (on) {
			await this.client.turnOn();
		} else {
			await this.client.turnOff();
		}
	};

	public toggle = async (): Promise<void> => {
		await this.client.toggle();
	};
}

export class WLEDLevelControlCluster
	extends ConfigurableCluster
	implements DeviceLevelControlCluster
{
	public currentLevel = new WLEDMapper(this, (state) => (state?.brightness ?? 0) / 255);

	public getName(): DeviceClusterName {
		return DeviceLevelControlCluster.clusterName;
	}

	public setLevel = ({ level }: { level: number }): Promise<void> => {
		return this.client.setBrightness(Math.round(level * 255));
	};

	// Does not exist, noop
	public startupLevel = new Data(1.0);

	// Does not exist, noop
	public setStartupLevel = (): Promise<void> => Promise.resolve();

	// Noop
	public stop = (): Promise<void> => Promise.resolve();
}

export class WLEDColorControlCluster
	extends ConfigurableCluster
	implements DeviceColorControlCluster
{
	public getName(): DeviceClusterName {
		return DeviceColorControlCluster.clusterName;
	}

	public color = new WLEDMapper(this, (state) => {
		const color = state.segments?.[0]?.colors?.[0];
		if (!color) {
			return new Color(0, 0, 0);
		}
		return new Color(color[0], color[1], color[2]);
	});

	public setColor = ({ color, index }: { color: Color; index?: number }): Promise<void> => {
		if (!this.client.state.segments) {
			return this.client.setColor([color.r, color.g, color.b]);
		}

		const segments = this.client.state.segments;
		const segmentIds = (() => {
			if (!index) {
				if (segments.every((segment) => segment.id !== undefined)) {
					return segments.map((segment) => segment.id!);
				}
				return undefined;
			}
			const segment = segments[index];
			if (!segment.id) {
				return undefined;
			}
			return [segment.id];
		})();

		return this.client.setColor([color.r, color.g, color.b], {
			segmentId: segmentIds,
		});
	};

	public getSegmentCount = (): number => this.client.state.segments.length;
	public setColorMulti = (options: { colors: Color[] }): Promise<void> => {
		const segments = this.client.state.segments;
		for (let i = 0; i < segments.length; i++) {
			const segment = segments[i];
			const color = options.colors[i % options.colors.length];
			segment.colors = [[color.r, color.g, color.b], ...(segment.colors?.slice(1) ?? [])];
		}
		return this.client.setSegments(segments);
	};
}
