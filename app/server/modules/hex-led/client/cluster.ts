import {
	DeviceActionsCluster,
	DeviceColorControlCluster,
	DeviceLevelControlCluster,
	DeviceOnOffCluster,
} from '../../device/cluster';
import type { ActionStruct, DeviceClusterName } from '../../device/cluster';
import { CombinedData, Data, MappedData } from '../../../lib/data';
import { EventEmitter } from '../../../lib/event-emitter';
import type { LEDClient, RGBColor } from './led-client';
import { Actions } from '@matter/main/clusters';
import type { Mapper } from '../../../lib/data';
import { Color } from '../../../lib/color';

class HexLEDMapper<S, M> extends MappedData<M, S> {
	public constructor(
		self: {
			client: LEDClient;
			onChange: EventEmitter<void>;
		},
		source: Data<S>,
		mapper: Mapper<S, M>,
		alwaysTrack?: boolean
	) {
		super(source, mapper, alwaysTrack);
		this.subscribe(() => self.onChange.emit(undefined));
	}

	public override async get(): Promise<Exclude<M, undefined>> {
		return super.get();
	}
}

class ConfigurableCluster {
	public onChange: EventEmitter<void> = new EventEmitter();

	public constructor(public readonly client: LEDClient) {
		client.onChange.listen(() => this.onChange.emit(undefined));
	}

	public [Symbol.dispose](): void {
		// Cleanup if needed
	}
}

export class HexLEDOnOffCluster extends ConfigurableCluster implements DeviceOnOffCluster {
	public isOn = new HexLEDMapper(this, this.client.state, (state) => state?.power_state ?? false);

	public getName(): DeviceClusterName {
		return DeviceOnOffCluster.clusterName;
	}

	public setOn = async (on: boolean): Promise<void> => {
		await this.client.setState({ power_state: on });
	};

	public toggle = async (): Promise<void> => {
		const currentState = await this.isOn.get();
		await this.setOn(!currentState);
	};
}

export class HexLEDLevelControlCluster
	extends ConfigurableCluster
	implements DeviceLevelControlCluster
{
	public getName(): DeviceClusterName {
		return DeviceLevelControlCluster.clusterName;
	}

	public currentLevel = new HexLEDMapper(
		this,
		this.client.state,
		(state) => state?.brightness ?? 1.0
	);

	public setLevel = async (args: { level: number; transitionTimeDs?: number }): Promise<void> => {
		await this.client.setState({ brightness: args.level });
	};

	// Does not exist, noop
	public startupLevel = new Data(1.0);

	// Does not exist, noop
	public setStartupLevel = (): Promise<void> => Promise.resolve();

	// Noop
	public stop = (): Promise<void> => Promise.resolve();
}

export class HexLEDColorControlCluster
	extends ConfigurableCluster
	implements DeviceColorControlCluster
{
	public getName(): DeviceClusterName {
		return DeviceColorControlCluster.clusterName;
	}

	public color = new HexLEDMapper(this, this.client.effects, (effects) => {
		const currentEffect = effects.current_effect;

		// Try to extract color from SingleColorEffect
		if (currentEffect === 'SingleColorEffect' || currentEffect === 'SingleColorRadialEffect') {
			const params = effects.effect_parameters[currentEffect];
			if (params?.color && params.color.type === 'color') {
				const colorValue = params.color.value as RGBColor;
				return new Color(colorValue.r, colorValue.g, colorValue.b);
			}
		}

		// Default color if no color effect is active
		return new Color(0, 0, 0);
	});

	public setColor = async (args: { color: Color; overDurationMs?: number }): Promise<void> => {
		const currentEffect = this.client.effects.current().current_effect;
		const effect = ['SingleColorEffect', 'SingleColorRadialEffect'].includes(currentEffect)
			? 'SingleColorRadialEffect'
			: 'SingleColorRadialEffect';
		await this.client.setEffect({
			effect_name: effect,
			parameters: {
				color: {
					r: args.color.r,
					g: args.color.g,
					b: args.color.b,
				},
			},
		});
	};
}

export class HexLEDActionsCluster extends ConfigurableCluster implements DeviceActionsCluster {
	public getName(): DeviceClusterName {
		return DeviceActionsCluster.clusterName;
	}

	public actionList = new HexLEDMapper(
		this,
		new CombinedData([this.client.presets, this.client.state]),
		([presets, state]) => {
			return presets.map(
				(preset): ActionStruct => ({
					id: preset.id,
					name: preset.name,
					type: Actions.ActionType.Other,
					state:
						state.active_preset_id === preset.id
							? Actions.ActionState.Active
							: Actions.ActionState.Inactive,
				})
			);
		}
	);

	public executeAction = async (args: { actionId: number }): Promise<void> => {
		const presets = this.client.presets.current();
		const preset = presets.find((p) => p.id === args.actionId);
		if (!preset) {
			throw new Error(`Preset with id ${args.actionId} not found`);
		}
		await this.client.applyPreset(preset);
	};
}
