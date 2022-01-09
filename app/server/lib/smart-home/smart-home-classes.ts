/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import {
	SmartHomeAttributes,
	SmartHomeDeviceSync,
	SmartHomeDeviceUpdateCallback,
	SmartHomeParam,
	SMART_HOME_COMMAND,
	SMART_HOME_DEVICE_TRAIT,
	GOOGLE_SMART_HOME_DEVICE_TYPE,
	SAMSUNG_SMART_HOME_DEVICE_TYPE,
	SmartHomeGoogleQuery,
	SmartHomeSamsungQuery,
} from './smart-home-types';
import { LED_NAMES, TEMPERATURE_REPORT_MAX_TIMEOUT } from '../constants';
import { ResponseLike, warning } from '../logger';
import { ModuleHookables } from '../../modules';
import { captureTime, time } from '../timer';
import { Batcher, pad } from '../util';
import { Color } from '../color';

export type QueryReturnType<
	TRAIT extends SMART_HOME_DEVICE_TRAIT = SMART_HOME_DEVICE_TRAIT
> = {
	trait: SMART_HOME_DEVICE_TRAIT;
	google: {
		value: SmartHomeGoogleQuery<TRAIT>;
	}[];
	samsung: {
		attribute: keyof SmartHomeSamsungQuery<TRAIT>;
		value: SmartHomeSamsungQuery<TRAIT>[keyof SmartHomeSamsungQuery<TRAIT>];
	}[];
}[];

type ExecuteReturnType<
	TRAIT extends SMART_HOME_DEVICE_TRAIT = SMART_HOME_DEVICE_TRAIT
> =
	| {
			success: true;
			mergeWithQuery: QueryReturnType<TRAIT>;
	  }
	| {
			success: false;
	  };

export abstract class SmartHomeDevice {
	protected temperatureID?: string;
	protected keyvalID?: string;
	protected rgbID?: LED_NAMES;

	public abstract id: string | LED_NAMES;
	public abstract name: string;
	public abstract nicknames: string[];

	protected get _queryID(): string {
		return this.keyvalID || this.rgbID || this.temperatureID || this.id;
	}

	protected get _queryFunctions(): ((
		hookables: ModuleHookables
	) => Promise<unknown[]>)[] {
		return [];
	}

	public get googleType(): GOOGLE_SMART_HOME_DEVICE_TYPE {
		throw new Error('Unset type');
	}

	public get samsungType(): SAMSUNG_SMART_HOME_DEVICE_TYPE {
		throw new Error('Unset type');
	}

	public get traits(): SMART_HOME_DEVICE_TRAIT[] {
		return [];
	}

	public get attributes(): {} {
		return {};
	}

	public get queryFunctions(): ((
		hookables: ModuleHookables
	) => Promise<QueryReturnType<SMART_HOME_DEVICE_TRAIT>>)[] {
		return this._queryFunctions as unknown as ((
			hookables: ModuleHookables
		) => Promise<QueryReturnType<SMART_HOME_DEVICE_TRAIT>>)[];
	}

	protected _execute(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_command: SMART_HOME_COMMAND,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_params: {},
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_hookables: ModuleHookables
	): Promise<unknown> {
		return Promise.resolve({
			success: true,
			mergeWithQuery: [],
		});
	}

	protected async _attachHomeGraphListeners(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_hookables: ModuleHookables,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_callback: unknown
	): Promise<void> {}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public isOnline(_hookables: ModuleHookables): Promise<boolean> {
		return Promise.resolve(true);
	}

	public sync(): SmartHomeDeviceSync {
		return {
			id: this.id,
			googleType: this.googleType,
			name: this.name,
			nicknames: this.nicknames,
			willReportState: true,
			attributes: this.attributes,
			traits: this.traits,
			samsungType: this.samsungType,
			self: this,
		};
	}

	public async query(
		hookables: ModuleHookables,
		res: ResponseLike
	): Promise<QueryReturnType> {
		let joined: QueryReturnType = [];
		const timing = captureTime();
		const awaited = await Promise.all(
			this.queryFunctions.map((q) => q(hookables))
		);

		for (const arr of awaited) {
			joined = [...joined, ...arr];
		}
		time(res, `${this.id} end, ${timing.getTime()}ms`);

		return joined;
	}

	public execute(
		_command: SMART_HOME_COMMAND,
		_params: {},
		_hookables: ModuleHookables
	): Promise<ExecuteReturnType> {
		return this._execute(
			_command,
			_params,
			_hookables
		) as Promise<ExecuteReturnType>;
	}

	public async attachHomeGraphListeners(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_hookables: ModuleHookables,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_callback: SmartHomeDeviceUpdateCallback
	): Promise<void> {}
}

export abstract class SmartHomeLight extends SmartHomeDevice {
	public get googleType() {
		return GOOGLE_SMART_HOME_DEVICE_TYPE.LIGHT;
	}
	public get samsungType() {
		return SAMSUNG_SMART_HOME_DEVICE_TYPE.SWITCH;
	}
}

export abstract class SmartHomeThermostat extends SmartHomeDevice {
	public get googleType() {
		return GOOGLE_SMART_HOME_DEVICE_TYPE.THERMOSTAT;
	}
	public get samsungType() {
		return SAMSUNG_SMART_HOME_DEVICE_TYPE.THERMOSTAT;
	}
}

export abstract class SmartHomeSpeaker extends SmartHomeDevice {
	public get googleType() {
		return GOOGLE_SMART_HOME_DEVICE_TYPE.SPEAKER;
	}
	public get samsungType() {
		return SAMSUNG_SMART_HOME_DEVICE_TYPE.SWITCH;
	}
}

export abstract class SmartHomeRadiator extends SmartHomeDevice {
	public get googleType() {
		return GOOGLE_SMART_HOME_DEVICE_TYPE.RADIATOR;
	}
	public get samsungType() {
		return SAMSUNG_SMART_HOME_DEVICE_TYPE.SWITCH;
	}
}

export abstract class SmartHomeScene extends SmartHomeDevice {
	public get googleType() {
		return GOOGLE_SMART_HOME_DEVICE_TYPE.SCENE;
	}
	public get samsungType() {
		return SAMSUNG_SMART_HOME_DEVICE_TYPE.SWITCH;
	}
}

export abstract class SmartHomeOutlet extends SmartHomeDevice {
	public get googleType() {
		return GOOGLE_SMART_HOME_DEVICE_TYPE.OUTLET;
	}
	public get samsungType() {
		return SAMSUNG_SMART_HOME_DEVICE_TYPE.SWITCH;
	}
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function SmartHomeMixinOnOffKeyval<
	C extends abstract new (...args: unknown[]) => {}
>(Constructor: C) {
	// @ts-ignore
	abstract class SmartHomeOnOff extends (Constructor as typeof SmartHomeDevice) {
		protected get _queryFunctions() {
			return [
				...super._queryFunctions,
				async (
					hookables: ModuleHookables
				): Promise<QueryReturnType<SMART_HOME_DEVICE_TRAIT.ON_OFF>> => {
					const isOn =
						(await hookables.keyval.get(this._queryID)) === '1';
					return this._getQueryReturn(isOn);
				},
			];
		}

		public get traits(): SMART_HOME_DEVICE_TRAIT[] {
			return [...super.traits, SMART_HOME_DEVICE_TRAIT.ON_OFF];
		}

		private _getQueryReturn(
			isOn: boolean
		): QueryReturnType<SMART_HOME_DEVICE_TRAIT.ON_OFF> {
			return [
				{
					trait: SMART_HOME_DEVICE_TRAIT.ON_OFF,
					google: [
						{
							value: {
								on: isOn,
							},
						},
					],
					samsung: [
						{
							attribute: 'switch',
							value: isOn ? 'on' : 'off',
						},
					],
				},
			];
		}

		protected async _execute(
			command: SMART_HOME_COMMAND,
			params: SmartHomeParam<SMART_HOME_COMMAND.ON_OFF>,
			hookables: ModuleHookables
		): Promise<ExecuteReturnType<SMART_HOME_DEVICE_TRAIT.ON_OFF>> {
			const superResult = await super.execute(command, params, hookables);
			if (
				command !== SMART_HOME_COMMAND.ON_OFF &&
				command !== SMART_HOME_COMMAND.SWITCH_ON &&
				command !== SMART_HOME_COMMAND.SWITCH_OFF
			) {
				return superResult as ExecuteReturnType<SMART_HOME_DEVICE_TRAIT.ON_OFF>;
			}
			if (!superResult.success) {
				return superResult;
			}

			const target = (() => {
				if (command === SMART_HOME_COMMAND.ON_OFF) {
					return params.on ? '1' : '0';
				}
				return command === SMART_HOME_COMMAND.SWITCH_ON ? '1' : '0';
			})();

			const status = await hookables.keyval.set(this._queryID, target);

			return {
				success: status,
				mergeWithQuery: [
					...superResult.mergeWithQuery,
					...this._getQueryReturn(target === '1'),
				] as QueryReturnType<SMART_HOME_DEVICE_TRAIT.ON_OFF>,
			};
		}

		protected async _attachHomeGraphListeners(
			hookables: ModuleHookables,
			callback: SmartHomeDeviceUpdateCallback<SMART_HOME_DEVICE_TRAIT.ON_OFF>
		) {
			await hookables.keyval.onChange(this._queryID, (value) => {
				callback({
					id: this.id,
					data: this._getQueryReturn(value === '1'),
				});
			});
		}
	}
	return SmartHomeOnOff;
}

export function SmartHomeMixinOnOffRGB<
	C extends abstract new (...args: unknown[]) => {}
>(Constructor: C) {
	// @ts-ignore
	abstract class SmartHomeOnOff extends (Constructor as typeof SmartHomeDevice) {
		protected get _queryFunctions() {
			return [
				...super._queryFunctions,
				async (
					hookables: ModuleHookables
				): Promise<QueryReturnType<SMART_HOME_DEVICE_TRAIT.ON_OFF>> => {
					const isOn = await (
						await hookables.RGB.getClient(
							this._queryID as LED_NAMES
						)
					)?.isOn();
					return this._getQueryReturn(isOn ?? false);
				},
			];
		}

		public get traits(): SMART_HOME_DEVICE_TRAIT[] {
			return [...super.traits, SMART_HOME_DEVICE_TRAIT.ON_OFF];
		}

		private _getQueryReturn(
			isOn: boolean
		): QueryReturnType<SMART_HOME_DEVICE_TRAIT.ON_OFF> {
			return [
				{
					trait: SMART_HOME_DEVICE_TRAIT.ON_OFF,
					google: [
						{
							value: {
								on: isOn,
							},
						},
					],
					samsung: [
						{
							attribute: 'switch',
							value: isOn ? 'on' : 'off',
						},
					],
				},
			];
		}

		protected async _execute(
			command: SMART_HOME_COMMAND,
			params: SmartHomeParam<SMART_HOME_COMMAND.ON_OFF>,
			hookables: ModuleHookables
		): Promise<ExecuteReturnType<SMART_HOME_DEVICE_TRAIT.ON_OFF>> {
			const superResult = await super.execute(command, params, hookables);
			if (
				command !== SMART_HOME_COMMAND.ON_OFF &&
				command !== SMART_HOME_COMMAND.SWITCH_ON &&
				command !== SMART_HOME_COMMAND.SWITCH_OFF
			) {
				return superResult as ExecuteReturnType<SMART_HOME_DEVICE_TRAIT.ON_OFF>;
			}
			if (!superResult.success) {
				return superResult;
			}

			const target = (() => {
				if (command === SMART_HOME_COMMAND.ON_OFF) {
					return params.on ? '1' : '0';
				}
				return command === SMART_HOME_COMMAND.SWITCH_ON ? '1' : '0';
			})();

			const status = await (await hookables.RGB.getClient(
				this._queryID as LED_NAMES
			))!.setPower(target === '1');

			return {
				success: status,
				mergeWithQuery: [
					...superResult.mergeWithQuery,
					...this._getQueryReturn(target === '1'),
				] as QueryReturnType<SMART_HOME_DEVICE_TRAIT.ON_OFF>,
			};
		}

		protected async _attachHomeGraphListeners(
			hookables: ModuleHookables,
			callback: SmartHomeDeviceUpdateCallback<SMART_HOME_DEVICE_TRAIT.ON_OFF>
		) {
			const client = await hookables.RGB.getClient(
				this._queryID as LED_NAMES
			);

			if (!client) {
				warning(
					`Failed to connect to RGB client with ID "${this._queryID}"`
				);
				return;
			}

			client.onPowerChange((isOn) => {
				callback({
					id: this.id,
					data: this._getQueryReturn(isOn),
				});
			});
		}

		public async isOnline(hookables: ModuleHookables) {
			return !!(await hookables.RGB.getClient(
				this._queryID as LED_NAMES
			));
		}
	}
	return SmartHomeOnOff;
}

export function SmartHomeMixinColorSetting<
	C extends abstract new (...args: unknown[]) => {}
>(Constructor: C) {
	// @ts-ignore
	abstract class SmartHomeColorsetting extends (Constructor as typeof SmartHomeDevice) {
		public abstract ledName: LED_NAMES;

		protected get _queryFunctions() {
			return [
				...super._queryFunctions,
				async (
					hookables: ModuleHookables
				): Promise<
					QueryReturnType<
						| SMART_HOME_DEVICE_TRAIT.COLOR_SETTING
						| SMART_HOME_DEVICE_TRAIT.SAMSUNG_BRIGHTNESS
					>
				> => {
					const color =
						(await (
							await hookables.RGB.getClient(
								this._queryID as LED_NAMES
							)
						)?.getColor()) || new Color(255);

					return this._getQueryReturnType(color);
				},
			];
		}

		public get traits(): SMART_HOME_DEVICE_TRAIT[] {
			return [
				...super.traits,
				SMART_HOME_DEVICE_TRAIT.COLOR_SETTING,
				SMART_HOME_DEVICE_TRAIT.SAMSUNG_BRIGHTNESS,
			];
		}

		public get attributes(): SmartHomeAttributes<
			| SMART_HOME_DEVICE_TRAIT.COLOR_SETTING
			| SMART_HOME_DEVICE_TRAIT.SAMSUNG_BRIGHTNESS
		> {
			return {
				...super.attributes,
				colorModel: 'rgb',
			};
		}

		private _getQueryReturnType(
			color: Color
		): QueryReturnType<
			| SMART_HOME_DEVICE_TRAIT.COLOR_SETTING
			| SMART_HOME_DEVICE_TRAIT.SAMSUNG_BRIGHTNESS
		> {
			return [
				{
					trait: SMART_HOME_DEVICE_TRAIT.COLOR_SETTING,
					google: [
						{
							attribute: 'color',
							value: {
								color: {
									spectrumRgb: color.toDecimal(),
									spectrumRGB: color.toDecimal(),
								},
							},
						},
					],
					samsung: [
						{
							attribute: 'hue',
							value: color.toHSV().hue / 2.55,
						},
						{
							attribute: 'saturation',
							value: color.toHSV().saturation / 2.55,
						},
						{
							attribute: 'brightness',
							value: color.toHSV().value / 2.55,
						},
					],
				},
			] as any;
		}

		protected async _execute(
			command: SMART_HOME_COMMAND,
			params: SmartHomeParam<SMART_HOME_COMMAND.COLOR_ABSOLUTE>,
			hookables: ModuleHookables
		): Promise<
			ExecuteReturnType<
				| SMART_HOME_DEVICE_TRAIT.COLOR_SETTING
				| SMART_HOME_DEVICE_TRAIT.SAMSUNG_BRIGHTNESS
			>
		> {
			const superResult = await super.execute(command, params, hookables);
			if (
				command !== SMART_HOME_COMMAND.COLOR_ABSOLUTE &&
				command !== SMART_HOME_COMMAND.COLOR_CONTROL_SET_COLOR &&
				command !== SMART_HOME_COMMAND.COLOR_CONTROL_SET_HUE &&
				command !== SMART_HOME_COMMAND.COLOR_CONTROL_SET_SATURATION &&
				command !== SMART_HOME_COMMAND.SWITCH_SET_LEVEL
			) {
				return superResult as ExecuteReturnType<
					| SMART_HOME_DEVICE_TRAIT.COLOR_SETTING
					| SMART_HOME_DEVICE_TRAIT.SAMSUNG_BRIGHTNESS
				>;
			}
			if (!superResult.success) {
				return superResult;
			}

			const getGoogleSetColor = () => {
				// We ignore the temperature setting because we don't pass
				// that availability
				if (
					'spectrumRGB' in params.color ||
					'spectrumRgb' in params.color
				) {
					const rgbColor =
						params.color['spectrumRGB'] ||
						params.color['spectrumRgb'];
					console.log(
						'color=',
						`#${pad(rgbColor.toString(16), 6, '0')}`,
						Color.fromHex(`#${pad(rgbColor.toString(16), 6, '0')}`)
					);
					return Color.fromHex(
						`#${pad(rgbColor.toString(16), 6, '0')}`
					);
				}
				if (
					'spectrumHSV' in params.color ||
					'spectrumHsv' in params.color
				) {
					const hsvColor =
						params.color['spectrumHSV'] ||
						params.color['spectrumHsv'];
					return Color.fromHSV(
						hsvColor.hue || 255,
						hsvColor.saturation || 255,
						hsvColor.value || 255
					);
				}
				warning('Unknown color format', params);
				return null;
			};

			const color = await (async (): Promise<Color | null> => {
				if (command === SMART_HOME_COMMAND.COLOR_ABSOLUTE) {
					return getGoogleSetColor();
				} else if (
					command === SMART_HOME_COMMAND.COLOR_CONTROL_SET_COLOR
				) {
					const colorParam = params[0] as
						| {
								hex: string;
						  }
						| {
								hue: number;
								saturation: number;
						  };
					if ('hex' in colorParam) {
						return Color.fromHex(colorParam.hex);
					} else {
						return Color.fromHSV(
							colorParam.hue * 2.55,
							colorParam.saturation * 2.55,
							255
						);
					}
				}
				const lastColor =
					(await (
						await hookables.RGB.getClient(
							this._queryID as LED_NAMES
						)
					)?.getColor()) || new Color(255);
				if (command === SMART_HOME_COMMAND.SWITCH_SET_LEVEL) {
					const hsv = lastColor.toHSV();
					return Color.fromHSV(
						hsv.hue,
						hsv.saturation,
						parseInt(params[0], 10) * 2.55
					);
				} else if (
					command === SMART_HOME_COMMAND.COLOR_CONTROL_SET_HUE
				) {
					const hsv = lastColor.toHSV();
					return Color.fromHSV(
						parseInt(params[0], 10) * 2.55,
						hsv.saturation,
						hsv.value
					);
				} else if (
					command === SMART_HOME_COMMAND.COLOR_CONTROL_SET_SATURATION
				) {
					const hsv = lastColor.toHSV();
					return Color.fromHSV(
						hsv.hue,
						parseInt(params[0], 10) * 2.55,
						hsv.value
					);
				}
				return null;
			})();
			if (
				!color ||
				!(await (await hookables.RGB.getClient(
					this._queryID as LED_NAMES
				))!.setColor(color.r, color.g, color.b))
			) {
				return {
					success: false,
				};
			}

			return {
				success: true,
				mergeWithQuery: [
					...superResult.mergeWithQuery,
					...this._getQueryReturnType(color),
				],
			} as ExecuteReturnType<
				| SMART_HOME_DEVICE_TRAIT.COLOR_SETTING
				| SMART_HOME_DEVICE_TRAIT.SAMSUNG_BRIGHTNESS
			>;
		}

		protected async _attachHomeGraphListeners(
			hookables: ModuleHookables,
			callback: SmartHomeDeviceUpdateCallback<
				| SMART_HOME_DEVICE_TRAIT.COLOR_SETTING
				| SMART_HOME_DEVICE_TRAIT.SAMSUNG_BRIGHTNESS
			>
		) {
			const client = await hookables.RGB.getClient(
				this._queryID as LED_NAMES
			);

			if (!client) {
				warning(
					`Failed to connect to RGB client with ID "${this._queryID}"`
				);
				return;
			}

			client.onColorChange((color) => {
				callback({
					id: this.id,
					data: this._getQueryReturnType(color),
				});
			});
		}
	}
	return SmartHomeColorsetting;
}

export function SmartHomeMixinBrightness<
	C extends abstract new (...args: unknown[]) => {}
>(Constructor: C) {
	// @ts-ignore
	abstract class SmartHomeBrightness extends (Constructor as typeof SmartHomeDevice) {
		protected get _queryFunctions() {
			return [
				...super._queryFunctions,
				async (
					hookables: ModuleHookables
				): Promise<
					QueryReturnType<SMART_HOME_DEVICE_TRAIT.BRIGHTNESS>
				> => {
					const brightness = await (
						await hookables.RGB.getClient(
							this._queryID as LED_NAMES
						)
					)?.getBrightness();
					if (!brightness) {
						return [];
					}
					return this._getQueryReturnType(brightness);
				},
			];
		}

		public get traits(): SMART_HOME_DEVICE_TRAIT[] {
			return [...super.traits, SMART_HOME_DEVICE_TRAIT.BRIGHTNESS];
		}

		public get attributes(): SmartHomeAttributes<SMART_HOME_DEVICE_TRAIT.BRIGHTNESS> {
			return {
				...super.attributes,
				// commandOnlyBrightness: true,
			};
		}

		private _getQueryReturnType(
			brightness: number
		): QueryReturnType<SMART_HOME_DEVICE_TRAIT.BRIGHTNESS> {
			return [
				{
					trait: SMART_HOME_DEVICE_TRAIT.BRIGHTNESS,
					google: [
						{
							value: {
								brightness,
							},
						},
					],
					samsung: [
						{
							attribute: 'level',
							value: brightness,
						},
					],
				},
			];
		}

		private async _executeBrightnessAbsolute(
			params: SmartHomeParam<SMART_HOME_COMMAND.BRIGHTNESS_ABSOLUTE>,
			hookables: ModuleHookables
		): Promise<{
			success: boolean;
			newBrightness: number;
		}> {
			return {
				success: await (await hookables.RGB.getClient(
					this._queryID as LED_NAMES
				))!.setBrightness(params.brightness),
				newBrightness: params.brightness,
			};
		}

		private async _executeBrightnessRelative(
			params: SmartHomeParam<SMART_HOME_COMMAND.BRIGHTNESS_RELATIVE>,
			hookables: ModuleHookables
		): Promise<{
			success: boolean;
			newBrightness: number;
		}> {
			const client = (await hookables.RGB.getClient(
				this._queryID as LED_NAMES
			))!;
			const brightness = (await client.getBrightness()) || 100;
			const newBrightness = (() => {
				if ('brightnessRelativePercent' in params) {
					return Math.min(
						100,
						Math.max(
							0,
							brightness + params.brightnessRelativePercent
						)
					);
				}
				if ('brightnessRelativeWeight' in params) {
					return Math.min(
						100,
						Math.max(
							0,
							brightness +
								brightness *
									(params.brightnessRelativeWeight * 0.2)
						)
					);
				}

				warning('Unknown brightness format', params);
				return null;
			})();
			if (newBrightness === null) {
				return {
					success: false,
					newBrightness: 0,
				};
			}

			return {
				success: await client.setBrightness(newBrightness),
				newBrightness,
			};
		}

		protected async _execute(
			command: SMART_HOME_COMMAND,
			params: {},
			hookables: ModuleHookables
		): Promise<ExecuteReturnType<SMART_HOME_DEVICE_TRAIT.BRIGHTNESS>> {
			const superResult = await super.execute(command, params, hookables);
			if (
				command !== SMART_HOME_COMMAND.BRIGHTNESS_ABSOLUTE &&
				command !== SMART_HOME_COMMAND.BRIGHTNESS_RELATIVE &&
				command !== SMART_HOME_COMMAND.SWITCH_SET_LEVEL
			) {
				return superResult as ExecuteReturnType<SMART_HOME_DEVICE_TRAIT.BRIGHTNESS>;
			}
			if (!superResult.success) {
				return superResult;
			}

			const { success, newBrightness } = await (() => {
				if (command === SMART_HOME_COMMAND.BRIGHTNESS_ABSOLUTE) {
					return this._executeBrightnessAbsolute(
						params as SmartHomeParam<SMART_HOME_COMMAND.BRIGHTNESS_ABSOLUTE>,
						hookables
					);
				} else if (command === SMART_HOME_COMMAND.BRIGHTNESS_RELATIVE) {
					return this._executeBrightnessRelative(
						params as SmartHomeParam<SMART_HOME_COMMAND.BRIGHTNESS_RELATIVE>,
						hookables
					);
				} else if (command === SMART_HOME_COMMAND.SWITCH_SET_LEVEL) {
					return this._executeBrightnessAbsolute(
						{
							brightness: (params as number[])[0],
						} as SmartHomeParam<SMART_HOME_COMMAND.BRIGHTNESS_ABSOLUTE>,
						hookables
					);
				}
				return {
					success: false,
					newBrightness: 0,
				};
			})();
			if (!success) {
				return {
					success: false,
				};
			}

			return {
				success: true,
				mergeWithQuery: [
					...superResult.mergeWithQuery,
					...this._getQueryReturnType(newBrightness),
				],
			} as ExecuteReturnType<SMART_HOME_DEVICE_TRAIT.BRIGHTNESS>;
		}

		protected async _attachHomeGraphListeners(
			hookables: ModuleHookables,
			callback: SmartHomeDeviceUpdateCallback<SMART_HOME_DEVICE_TRAIT.BRIGHTNESS>
		) {
			const client = await hookables.RGB.getClient(
				this._queryID as LED_NAMES
			);

			if (!client) {
				warning(
					`Failed to connect to RGB client with ID "${this._queryID}"`
				);
				return;
			}

			client.onBrightnessChange((brightness) => {
				callback({
					id: this.id,
					data: this._getQueryReturnType(brightness),
				});
			});
		}
	}
	return SmartHomeBrightness;
}

// export function SmartHomeMixinScene<
// 	C extends abstract new (...args: unknown[]) => {}
// >(Constructor: C) {
// 	// @ts-ignore
// 	abstract class SmartHomeScene extends (Constructor as typeof SmartHomeDevice) {
// 		public get traits(): SMART_HOME_DEVICE_TRAIT[] {
// 			return [...super.traits, SMART_HOME_DEVICE_TRAIT.SCENE];
// 		}

// 		public get attributes(): SmartHomeAttributes<SMART_HOME_DEVICE_TRAIT.SCENE> {
// 			return {
// 				...super.attributes,
// 				sceneReversible: true,
// 			};
// 		}

// 		public async execute(
// 			command: SMART_HOME_COMMAND,
// 			params: SmartHomeParam<SMART_HOME_COMMAND.ACTIVATE_SCENE>,
// 			hookables: ModuleHookables
// 		): Promise<ExecuteReturnType<SMART_HOME_DEVICE_TRAIT.SCENE>> {
// 			const superResult = await super.execute(command, params, hookables);
// 			if (command !== SMART_HOME_COMMAND.ACTIVATE_SCENE) {
// 				return superResult;
// 			}
// 			if (!superResult.success) {
// 				return superResult;
// 			}

// 			return {
// 				success: await hookables.keyval.set(
// 					this._queryID,
// 					!params.deactivate ? '1' : '0'
// 				),
// 				mergeWithQuery: {
// 					...superResult.mergeWithQuery,
// 				},
// 			};
// 		}

// 		/**
// 		 * Currently disabled since this is not yet supported by Google
// 		 * (https://developers.google.com/assistant/smarthome/traits/scene)
// 		 */
// 		// public async attachHomeGraphListeners(
// 		// 	hookables: ModuleHookables,
// 		// 	callback: SmartHomeDeviceUpdateCallback<SMART_HOME_DEVICE_TRAIT.SCENE>
// 		// ) {
// 		// 	hookables.keyval.onChange(this._queryID, (value) => {
// 		// 		callback({
// 		// 			id: this.id,
// 		// 			data: {
// 		// 				on: value === '1',
// 		// 			},
// 		// 		});
// 		// 	});
// 		// }
// 	}
// 	return SmartHomeScene;
// }

// export function SmartHomeMixinTemperatureControl<
// 	C extends abstract new (...args: unknown[]) => {}
// >(Constructor: C) {
// 	// @ts-ignore
// 	abstract class SmartHomeTemperatureControl extends (Constructor as typeof SmartHomeDevice) {
// 		public get traits(): SMART_HOME_DEVICE_TRAIT[] {
// 			return [
// 				...super.traits,
// 				SMART_HOME_DEVICE_TRAIT.TEMPERATURE_CONTROL,
// 			];
// 		}

// 		public get attributes(): SmartHomeAttributes<SMART_HOME_DEVICE_TRAIT.TEMPERATURE_CONTROL> {
// 			return {
// 				...super.attributes,
// 				temperatureRange: {
// 					minThresholdCelcius: 0,
// 					maxThresholdCelcius: 100,
// 				},
// 				temperatureStepCelsius: 0.1,
// 				temperatureUnitForUX: 'C',
// 				// queryOnlyTemperatureControl: true,
// 			};
// 		}

// 		public get queryFunctions() {
// 			return [
// 				...super.queryFunctions,
// 				async (
// 					hookables: ModuleHookables
// 				): Promise<
// 					SmartHomeQuery<SMART_HOME_DEVICE_TRAIT.TEMPERATURE_CONTROL>
// 				> => {
// 					return {
// 						temperatureAmbientCelsius: (
// 							await hookables.temperature.getTemp(this._queryID)
// 						).temp,
// 					};
// 				},
// 			];
// 		}

// 		public async execute(
// 			command: SMART_HOME_COMMAND,
// 			params: SmartHomeParam<SMART_HOME_COMMAND.SET_TEMPERATURE>,
// 			hookables: ModuleHookables
// 		): Promise<
// 			ExecuteReturnType<SMART_HOME_DEVICE_TRAIT.TEMPERATURE_CONTROL>
// 		> {
// 			const superResult = await super.execute(command, params, hookables);
// 			if (command !== SMART_HOME_COMMAND.SET_TEMPERATURE) {
// 				return superResult;
// 			}
// 			if (!superResult.success) {
// 				return superResult;
// 			}

// 			warning('Setting of temperature not supported');
// 			return {
// 				success: false,
// 			};
// 		}

// 		public async attachHomeGraphListeners(
// 			hookables: ModuleHookables,
// 			callback: SmartHomeDeviceUpdateCallback<SMART_HOME_DEVICE_TRAIT.TEMPERATURE_CONTROL>
// 		) {
// 			const batcher = new Batcher<number>({
// 				minWaitTime: TEMPERATURE_REPORT_MAX_TIMEOUT,
// 				maxWaitTime: TEMPERATURE_REPORT_MAX_TIMEOUT,
// 				onDispatch: (data) => {
// 					// We only really care about the last measurement
// 					// because nobody cares about the previous temperature
// 					const lastTemp = data[data.length - 1];

// 					callback({
// 						id: this.id,
// 						data: {
// 							temperatureAmbientCelsius: lastTemp,
// 						},
// 					});
// 				},
// 			});

// 			await hookables.temperature.onUpdate(this._queryID, (value) => {
// 				batcher.call(value);
// 			});
// 		}
// 	}
// 	return SmartHomeTemperatureControl;
// }

export function SmartHomeMixinTemperatureSetting<
	C extends abstract new (...args: unknown[]) => {}
>(Constructor: C) {
	// @ts-ignore
	abstract class SmartHomeTemperatureControl extends (Constructor as typeof SmartHomeDevice) {
		protected get _queryFunctions() {
			return [
				...super._queryFunctions,
				async (
					hookables: ModuleHookables
				): Promise<
					QueryReturnType<SMART_HOME_DEVICE_TRAIT.TEMPERATURE_SETTING_AND_READING>
				> => {
					const temperature = (
						await hookables.temperature.getTemp(this._queryID)
					).temp;
					return this._getQueryReturn(temperature);
				},
			];
		}

		public get traits(): SMART_HOME_DEVICE_TRAIT[] {
			return [
				...super.traits,
				SMART_HOME_DEVICE_TRAIT.TEMPERATURE_SETTING_AND_READING,
			];
		}

		public get attributes(): SmartHomeAttributes<SMART_HOME_DEVICE_TRAIT.TEMPERATURE_SETTING_AND_READING> {
			return {
				...super.attributes,
				thermostatTemperatureRange: {
					minThresholdCelcius: 0,
					maxThresholdCelcius: 100,
				},
				thermostatTemperatureUnit: 'C',
				availableThermostatModes: ['off', 'on'],
				// queryOnlyTemperatureSetting: true,
			};
		}

		private _getQueryReturn(
			temperature: number
		): QueryReturnType<SMART_HOME_DEVICE_TRAIT.TEMPERATURE_SETTING_AND_READING> {
			return [
				{
					trait: SMART_HOME_DEVICE_TRAIT.TEMPERATURE_SETTING_AND_READING,
					google: [
						{
							value: {
								activeThermostatMode: 'none',
								thermostatMode: 'none',
								thermostatTemperatureSetpoint: temperature,
								thermostatTemperatureAmbient: temperature,
							},
						},
					],
					samsung: [
						{
							attribute: 'temperature',
							value: temperature,
						},
					],
				},
			];
		}

		protected async _execute(
			command: SMART_HOME_COMMAND,
			params: SmartHomeParam<SMART_HOME_COMMAND.SET_TEMPERATURE>,
			hookables: ModuleHookables
		): Promise<
			ExecuteReturnType<SMART_HOME_DEVICE_TRAIT.TEMPERATURE_SETTING_AND_READING>
		> {
			const superResult = await super.execute(command, params, hookables);
			if (command !== SMART_HOME_COMMAND.SET_TEMPERATURE) {
				return superResult as ExecuteReturnType<SMART_HOME_DEVICE_TRAIT.TEMPERATURE_SETTING_AND_READING>;
			}
			if (!superResult.success) {
				return superResult;
			}

			warning('Setting of temperature not supported');
			return {
				success: false,
			};
		}

		protected async _attachHomeGraphListeners(
			hookables: ModuleHookables,
			callback: SmartHomeDeviceUpdateCallback<SMART_HOME_DEVICE_TRAIT.TEMPERATURE_SETTING_AND_READING>
		) {
			const batcher = new Batcher<number>({
				minWaitTime: TEMPERATURE_REPORT_MAX_TIMEOUT,
				maxWaitTime: TEMPERATURE_REPORT_MAX_TIMEOUT,
				onDispatch: (data) => {
					// We only really care about the last measurement
					// because nobody cares about the previous temperature
					const lastTemp = data[data.length - 1];

					callback({
						id: this.id,
						data: this._getQueryReturn(lastTemp),
					});
				},
			});

			await hookables.temperature.onUpdate(this._queryID, (value) => {
				batcher.call(value);
			});
		}
	}
	return SmartHomeTemperatureControl;
}
