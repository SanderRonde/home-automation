import {
	DeviceColorControlXYCluster,
	DeviceLevelControlCluster,
	DeviceOnOffCluster,
} from '../../device/cluster';
import type { WLEDClient, WLEDClientPresets, WLEDClientState } from 'wled-client';
import { DeviceActionsCluster } from '../../device/cluster';
import { EventEmitter } from '../../../lib/event-emitter';
import type { DeviceAction } from '../../device/cluster';
import { Data, MappedData } from '../../../lib/data';
import { CombinedData } from '../../../lib/data';
import { Actions } from '@matter/main/clusters';
import type { Mapper } from '../../../lib/data';
import { Color } from '../../../lib/color';

class WLEDMapper<D, M> extends MappedData<M, D> {
	public constructor(
		self: { onChange: EventEmitter<void> },
		data: Data<D>,
		mapper: Mapper<D, M>
	) {
		super(data, mapper, false);
		this.subscribe((_value, isInitial) => {
			if (!isInitial) {
				return self.onChange.emit(undefined);
			}
		});
	}
}

class WLEDProxy implements Disposable {
	public state: Data<WLEDClientState>;
	public presets: Data<WLEDClientPresets>;

	public constructor(
		private readonly _client: WLEDClient,
		public readonly onChange: EventEmitter<void>
	) {
		this._client = _client;
		this.state = new Data(this._client.state);
		this.presets = new Data(this._client.presets);

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
		this.presets.set(this._client.presets);
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
		this.proxy = new WLEDProxy(client, this.onChange);
	}

	public [Symbol.dispose](): void {
		this.proxy[Symbol.dispose]();
	}
}

export class WLEDOnOffCluster extends ConfigurableCluster implements DeviceOnOffCluster {
	public isOn = new WLEDMapper(this, this.proxy.state, (state) => state?.on ?? false);

	public getBaseCluster(): typeof DeviceOnOffCluster {
		return DeviceOnOffCluster;
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
	public currentLevel = new WLEDMapper(
		this,
		this.proxy.state,
		(state) => (state?.brightness ?? 0) / 255
	);

	public getBaseCluster(): typeof DeviceLevelControlCluster {
		return DeviceLevelControlCluster;
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
	implements DeviceColorControlXYCluster
{
	public getBaseCluster(): typeof DeviceColorControlXYCluster {
		return DeviceColorControlXYCluster;
	}
	public getClusterVariant(): 'xy' {
		return 'xy';
	}

	public color = new WLEDMapper(this, this.proxy.state, (state) => {
		const color = state.segments?.[0]?.colors?.[0];
		if (!color) {
			return new Color(0, 0, 0);
		}
		return new Color(color[0], color[1], color[2]);
	});

	public setColor = async ({ colors }: { colors: Color[] }): Promise<void> => {
		if (!this.client.state.segments || colors.length === 1) {
			await this.client.setEffect(0);
			await this.client.setColor([colors[0].r, colors[0].g, colors[0].b]);
			return;
		}

		// Sort segments by ID to ensure we process them in order and don't skip any
		const segments = [...this.client.state.segments].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
		for (const [i, segment] of segments.entries()) {
			const color = colors[i % colors.length];
			await this.client.setEffect(0, {
				segmentId: segment.id,
			});
			await this.client.setColor([color.r, color.g, color.b], {
				segmentId: segment.id,
			});
		}
	};

	public getSegmentCount = (): number => this.client.state.segments.length;
}

export class WLEDActionsCluster extends ConfigurableCluster implements DeviceActionsCluster {
	public getBaseCluster(): typeof DeviceActionsCluster {
		return DeviceActionsCluster;
	}

	public executeAction = async (args: { actionId: number }): Promise<void> => {
		await this.client.setPreset(args.actionId);
	};

	public actionList = new WLEDMapper(
		this,
		new CombinedData([this.proxy.state, this.proxy.presets]),
		([state, presets]) => {
			const actions: DeviceAction[] = [];
			for (const id in presets) {
				const preset = presets[id];
				actions.push({
					id: Number(id),
					name: preset.name || `Preset ${id}`,
					type: Actions.ActionType.Scene,
					state:
						state.presetId === Number(id)
							? Actions.ActionState.Active
							: Actions.ActionState.Inactive,
				});
			}
			return actions;
		}
	);
}
