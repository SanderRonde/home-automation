import {
	DeviceActionsCluster,
	DeviceLevelControlCluster,
	DeviceOnOffCluster,
} from '../../device/cluster';
import { DeviceColorControlXYCluster } from '../../device/cluster';
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
	public isOn = new LEDArtMapper(
		this,
		this.client.state,
		(state) => state?.target_power_state ?? false
	);

	public getBaseCluster(): typeof DeviceOnOffCluster {
		return DeviceOnOffCluster;
	}

	public setOn = async (on: boolean): Promise<void> => {
		if (this.client.state.current().target_power_state === on) {
			return;
		}
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

	public step = new Data(1 / 100);

	public name = new Data('Brightness');

	// Does not exist, noop
	public setStartupLevel = (): Promise<void> => Promise.resolve();

	// Noop
	public stop = (): Promise<void> => Promise.resolve();
}

export class LEDArtColorControlCluster
	extends ConfigurableCluster
	implements DeviceColorControlXYCluster
{
	public getBaseCluster(): typeof DeviceColorControlXYCluster {
		return DeviceColorControlXYCluster;
	}
	public getClusterVariant(): 'xy' {
		return 'xy';
	}

	public colors = new LEDArtMapper(this, this.client.effects, (effects) => {
		const currentEffect = effects.current_effect;

		// Try to extract color from SingleColorEffect
		if (currentEffect === 'SingleColorEffect' || currentEffect === 'SingleColorRadialEffect') {
			const params = effects.effect_parameters[currentEffect];
			if (params?.color?.type === 'color') {
				const colorValue = params.color.value as RGBColor;
				return [new Color(colorValue.r, colorValue.g, colorValue.b)];
			}
		}

		// Color list
		if (currentEffect === 'MultiColorRadialEffect') {
			const params = effects.effect_parameters[currentEffect];
			if (params?.colors?.type === 'color_list') {
				const colorList = params.colors.value as RGBColor[];
				return colorList.map((color) => new Color(color.r, color.g, color.b));
			}
		}

		// Default color if no color effect is active
		return [];
	});

	public setColor = async (args: { colors: Color[]; overDurationMs?: number }): Promise<void> => {
		// Convert colors to HSL, set L to 0.5, then convert back to RGB
		const adjustedColors = args.colors.map((color) => {
			const hsl = color.toHSL();
			return Color.fromHSL(hsl.hue, hsl.saturation, 0.5);
		});

		if (adjustedColors.length === 1) {
			const currentEffect = this.client.effects.current().current_effect;
			const effect =
				currentEffect === 'SingleColorEffect'
					? 'SingleColorEffect'
					: 'SingleColorRadialEffect';
			await this.client.setEffect({
				effect_name: effect,
				parameters: {
					color: {
						r: adjustedColors[0].r,
						g: adjustedColors[0].g,
						b: adjustedColors[0].b,
					},
				},
			});
		} else {
			const currentEffect = this.client.effects.current().current_effect;
			const effect =
				currentEffect === 'MultiColorEffect'
					? 'MultiColorEffect'
					: 'MultiColorRadialEffect';
			await this.client.setEffect({
				effect_name: effect,
				parameters: {
					colors: adjustedColors.map((color) => ({
						r: color.r,
						g: color.g,
						b: color.b,
					})),
					direction: 'in',
					interpolation: 'hsv',
					speed: 0.4,
				},
			});
		}
	};

	public getSegmentCount = (): number => 2;
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
