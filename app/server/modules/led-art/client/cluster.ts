import {
	DeviceActionsCluster,
	DeviceColorControlCluster,
	DeviceLevelControlCluster,
	DeviceOnOffCluster,
} from '../../device/cluster';
import { CombinedData, Data, MappedData } from '../../../lib/data';
import { EventEmitter } from '../../../lib/event-emitter';
import type { DeviceAction } from '../../device/cluster';
import type { LEDClient, RGBColor } from './led-client';
import { Actions } from '@matter/main/clusters';
import type { Mapper } from '../../../lib/data';
import { Color } from '../../../lib/color';

class LEDArtMapper<S, M> extends MappedData<M, S> {
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
		this.subscribe((_value, isInitial) => {
			if (!isInitial) {
				return self.onChange.emit(undefined);
			}
		});
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

export class LEDArtOnOffCluster extends ConfigurableCluster implements DeviceOnOffCluster {
	public isOn = new LEDArtMapper(this, this.client.state, (state) => state?.power_state ?? false);

	public getBaseCluster(): typeof DeviceOnOffCluster {
		return DeviceOnOffCluster;
	}

	public setOn = async (on: boolean): Promise<void> => {
		await this.client.setState({ power_state: on });
	};

	public toggle = async (): Promise<void> => {
		const currentState = await this.isOn.get();
		await this.setOn(!currentState);
	};
}

export class LEDArtLevelControlCluster
	extends ConfigurableCluster
	implements DeviceLevelControlCluster
{
	public getBaseCluster(): typeof DeviceLevelControlCluster {
		return DeviceLevelControlCluster;
	}

	public currentLevel = new LEDArtMapper(
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

export class LEDArtColorControlCluster
	extends ConfigurableCluster
	implements DeviceColorControlCluster
{
	public getBaseCluster(): typeof DeviceColorControlCluster {
		return DeviceColorControlCluster;
	}

	public color = new LEDArtMapper(this, this.client.effects, (effects) => {
		const currentEffect = effects.current_effect;

		// Try to extract color from SingleColorEffect
		if (currentEffect === 'SingleColorEffect' || currentEffect === 'SingleColorRadialEffect') {
			const params = effects.effect_parameters[currentEffect];
			if (params?.color?.type === 'color') {
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

	public getSegmentCount = (): number => 1;
}

export class LEDArtActionsCluster extends ConfigurableCluster implements DeviceActionsCluster {
	public getBaseCluster(): typeof DeviceActionsCluster {
		return DeviceActionsCluster;
	}

	public actionList = new LEDArtMapper(
		this,
		new CombinedData([this.client.presets, this.client.state]),
		([presets, state]) => {
			return presets.map(
				(preset): DeviceAction => ({
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
		const actionList = await this.actionList.get();
		const action = actionList.find((a) => a.id === args.actionId);
		if (action?.state === Actions.ActionState.Active) {
			// Already active
			return;
		}
		const presets = this.client.presets.current();
		const preset = presets.find((p) => p.id === args.actionId);
		if (!preset) {
			throw new Error(`Preset with id ${args.actionId} not found`);
		}
		await this.client.applyPreset(preset);
	};
}
