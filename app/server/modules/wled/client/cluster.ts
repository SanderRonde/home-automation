import {
	DeviceColorControlCluster,
	DeviceLevelControlCluster,
	DeviceOnOffCluster,
} from '../../device/cluster';
import type { Cluster, DeviceClusterName } from '../../device/cluster';
import type { WLEDClient, WLEDClientState } from 'wled-client';
import { Data, MappedData } from '../../../lib/data';
import type { Mapper } from '../../../lib/data';
import { Color } from '../../../lib/color';

class WLEDState extends Data<WLEDClientState> {
	public constructor(private readonly _client: WLEDClient) {
		super(_client.state);
	}

	public override async get(): Promise<WLEDClientState> {
		await this._client.refreshState();
		return super.get();
	}
}

class WLEDMapper<M> extends MappedData<M, WLEDClientState> {
	public constructor(
		private readonly _client: WLEDClient,
		upstream: Data<WLEDClientState>,
		mapper: Mapper<WLEDClientState, M>,
		alwaysTrack?: boolean
	) {
		super(upstream, mapper, alwaysTrack);
	}

	public override async get(): Promise<Exclude<M, undefined>> {
		await this._client.refreshState();
		return super.get();
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

function ConfigurableCluster(
	Base: abstract new () => Cluster & {
		getName: () => DeviceClusterName;
	}
) {
	return class extends Base {
		protected _proxy: WLEDProxy;

		public constructor(protected readonly _client: WLEDClient) {
			super();
			this._proxy = new WLEDProxy(this._client);
		}

		public [Symbol.dispose](): void {
			this._proxy[Symbol.dispose]();
		}
	};
}

export class WLEDOnOffCluster extends ConfigurableCluster(DeviceOnOffCluster) {
	public isOn = new WLEDMapper(
		this._client,
		this._proxy.state,
		(state) => state?.on ?? false
	);

	public setOn = async (on: boolean): Promise<void> => {
		if (on) {
			await this._client.turnOn();
		} else {
			await this._client.turnOff();
		}
	};

	public toggle = async (): Promise<void> => {
		await this._client.toggle();
	};
}

export class WLEDLevelControlCluster extends ConfigurableCluster(
	DeviceLevelControlCluster
) {
	public currentLevel = new WLEDMapper(
		this._client,
		this._proxy.state,
		(state) => (state?.brightness ?? 0) / 255
	);

	public setLevel = (level: number): Promise<void> => {
		return this._client.setBrightness(Math.round(level * 255));
	};

	// Does not exist, noop
	public startupLevel = new Data(1.0);

	// Does not exist, noop
	public setStartupLevel = (): Promise<void> => Promise.resolve();

	// Noop
	public stop = (): Promise<void> => Promise.resolve();
}

export class WLEDColorControlCluster extends ConfigurableCluster(
	DeviceColorControlCluster
) {
	public color = new WLEDMapper(this._client, this._proxy.state, (state) => {
		const color = state.segments[0].colors?.[0];
		if (!color) {
			return new Color(0, 0, 0);
		}
		return new Color(color[0], color[1], color[2]);
	});

	public setColor = (color: Color): Promise<void> => {
		return this._client.setColor([color.r, color.g, color.b]);
	};
}
