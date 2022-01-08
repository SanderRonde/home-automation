/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import {
	SmartHomeAttributes,
	SmartHomeDeviceSync,
	SmartHomeDeviceUpdateCallback,
	SmartHomeParam,
	SmartHomeQuery,
	SMART_HOME_COMMAND,
	SMART_HOME_DEVICE_TRAIT,
	SMART_HOME_DEVICE_TYPE,
} from './smart-home-types';
import { LED_NAMES, TEMPERATURE_REPORT_MAX_TIMEOUT } from '../constants';
import { ModuleHookables } from '../../modules';
import { captureTime, time } from '../timer';
import { Batcher, pad } from '../util';
import { warning } from '../logger';
import * as express from 'express';
import { Color } from '../color';

type ExecuteReturnType<TRAIT extends SMART_HOME_DEVICE_TRAIT> =
	| {
			success: true;
			mergeWithQuery: Partial<SmartHomeQuery<TRAIT>> &
				Record<string, unknown>;
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

	public get type(): SMART_HOME_DEVICE_TYPE {
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
	) => Promise<{}>)[] {
		return [];
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public isOnline(_hookables: ModuleHookables): Promise<boolean> {
		return Promise.resolve(true);
	}

	public sync(): SmartHomeDeviceSync {
		return {
			id: this.id,
			type: this.type,
			name: this.name,
			nicknames: this.nicknames,
			willReportState: true,
			attributes: this.attributes,
			traits: this.traits,
		};
	}

	public async query(
		hookables: ModuleHookables,
		res: express.Response
	): Promise<{}> {
		const timing = captureTime();
		let joined: {} = {};
		const awaited = await Promise.all(
			this.queryFunctions.map((q) => q(hookables))
		);
		time(res, `${this.id} end, ${timing.getTime()}ms`);

		for (const value of awaited) {
			joined = {
				...joined,
				...value,
			};
		}
		return joined;
	}

	public execute(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_command: SMART_HOME_COMMAND,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_params: {},
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_hookables: ModuleHookables
	): Promise<ExecuteReturnType<any>> {
		return Promise.resolve({
			success: true,
			mergeWithQuery: {},
		});
	}

	public async attachHomeGraphListeners(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_hookables: ModuleHookables,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		_callback: SmartHomeDeviceUpdateCallback
	): Promise<void> {}
}

export abstract class SmartHomeLight extends SmartHomeDevice {
	public get type() {
		return SMART_HOME_DEVICE_TYPE.LIGHT;
	}
}

export abstract class SmartHomeThermostat extends SmartHomeDevice {
	public get type() {
		return SMART_HOME_DEVICE_TYPE.THERMOSTAT;
	}
}

export abstract class SmartHomeSpeaker extends SmartHomeDevice {
	public get type() {
		return SMART_HOME_DEVICE_TYPE.SPEAKER;
	}
}

export abstract class SmartHomeRadiator extends SmartHomeDevice {
	public get type() {
		return SMART_HOME_DEVICE_TYPE.RADIATOR;
	}
}

export abstract class SmartHomeSensor extends SmartHomeDevice {
	public get type() {
		return SMART_HOME_DEVICE_TYPE.SENSOR;
	}
}

export abstract class SmartHomeScene extends SmartHomeDevice {
	public get type() {
		return SMART_HOME_DEVICE_TYPE.SCENE;
	}
}

export abstract class SmartHomeOutlet extends SmartHomeDevice {
	public get type() {
		return SMART_HOME_DEVICE_TYPE.OUTLET;
	}
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function SmartHomeMixinOnOffKeyval<
	C extends abstract new (...args: unknown[]) => {}
>(Constructor: C) {
	// @ts-ignore
	abstract class SmartHomeOnOff extends (Constructor as typeof SmartHomeDevice) {
		public get traits(): SMART_HOME_DEVICE_TRAIT[] {
			return [...super.traits, SMART_HOME_DEVICE_TRAIT.ON_OFF];
		}

		public get queryFunctions() {
			return [
				...super.queryFunctions,
				async (
					hookables: ModuleHookables
				): Promise<SmartHomeQuery<SMART_HOME_DEVICE_TRAIT.ON_OFF>> => {
					return {
						on: (await hookables.keyval.get(this._queryID)) === '1',
					};
				},
			];
		}

		public async execute(
			command: SMART_HOME_COMMAND,
			params: SmartHomeParam<SMART_HOME_COMMAND.ON_OFF>,
			hookables: ModuleHookables
		): Promise<ExecuteReturnType<SMART_HOME_DEVICE_TRAIT.ON_OFF>> {
			const superResult = await super.execute(command, params, hookables);
			if (command !== SMART_HOME_COMMAND.ON_OFF) {
				return superResult;
			}
			if (!superResult.success) {
				return superResult;
			}

			const status = await hookables.keyval.set(
				this._queryID,
				params.on ? '1' : '0'
			);

			return {
				success: status,
				mergeWithQuery: {
					...superResult.mergeWithQuery,
					on: params.on,
				},
			};
		}

		public async attachHomeGraphListeners(
			hookables: ModuleHookables,
			callback: SmartHomeDeviceUpdateCallback<SMART_HOME_DEVICE_TRAIT.ON_OFF>
		) {
			await hookables.keyval.onChange(this._queryID, (value) => {
				callback({
					id: this.id,
					data: {
						on: value === '1',
					},
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
		public get traits(): SMART_HOME_DEVICE_TRAIT[] {
			return [...super.traits, SMART_HOME_DEVICE_TRAIT.ON_OFF];
		}

		public get queryFunctions() {
			return [
				...super.queryFunctions,
				async (
					hookables: ModuleHookables
				): Promise<SmartHomeQuery<SMART_HOME_DEVICE_TRAIT.ON_OFF>> => {
					return {
						on: await (
							await hookables.RGB.getClient(
								this._queryID as LED_NAMES
							)
						)?.isOn(),
					};
				},
			];
		}

		public async isOnline(hookables: ModuleHookables) {
			return !!(await hookables.RGB.getClient(
				this._queryID as LED_NAMES
			));
		}

		public async execute(
			command: SMART_HOME_COMMAND,
			params: SmartHomeParam<SMART_HOME_COMMAND.ON_OFF>,
			hookables: ModuleHookables
		): Promise<ExecuteReturnType<SMART_HOME_DEVICE_TRAIT.ON_OFF>> {
			const superResult = await super.execute(command, params, hookables);
			if (command !== SMART_HOME_COMMAND.ON_OFF) {
				return superResult;
			}
			if (!superResult.success) {
				return superResult;
			}

			const status = await (await hookables.RGB.getClient(
				this._queryID as LED_NAMES
			))!.setPower(params.on);

			return {
				success: status,
				mergeWithQuery: {
					...superResult.mergeWithQuery,
					on: params.on,
				},
			};
		}

		public async attachHomeGraphListeners(
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
					data: {
						on: isOn,
					},
				});
			});
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

		public get traits(): SMART_HOME_DEVICE_TRAIT[] {
			return [...super.traits, SMART_HOME_DEVICE_TRAIT.COLOR_SETTING];
		}

		public get attributes(): SmartHomeAttributes<SMART_HOME_DEVICE_TRAIT.COLOR_SETTING> {
			return {
				...super.attributes,
				colorModel: 'rgb',
			};
		}

		public get queryFunctions() {
			return [
				...super.queryFunctions,
				async (
					hookables: ModuleHookables
				): Promise<
					SmartHomeQuery<SMART_HOME_DEVICE_TRAIT.COLOR_SETTING>
				> => {
					const color =
						(await (
							await hookables.RGB.getClient(
								this._queryID as LED_NAMES
							)
						)?.getColor()) || new Color(255);
					return {
						color: {
							spectrumRgb: color.toDecimal(),
							spectrumRGB: color.toDecimal(),
						},
					};
				},
			];
		}

		public async execute(
			command: SMART_HOME_COMMAND,
			params: SmartHomeParam<SMART_HOME_COMMAND.COLOR_ABSOLUTE>,
			hookables: ModuleHookables
		): Promise<ExecuteReturnType<SMART_HOME_DEVICE_TRAIT.COLOR_SETTING>> {
			const superResult = await super.execute(command, params, hookables);
			if (command !== SMART_HOME_COMMAND.COLOR_ABSOLUTE) {
				return superResult;
			}
			if (!superResult.success) {
				return superResult;
			}

			const color = (() => {
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
				mergeWithQuery: {
					...superResult.mergeWithQuery,
					color: params.color,
				},
			};
		}

		public async attachHomeGraphListeners(
			hookables: ModuleHookables,
			callback: SmartHomeDeviceUpdateCallback<SMART_HOME_DEVICE_TRAIT.COLOR_SETTING>
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
					data: {
						color: {
							spectrumRgb: color.toDecimal(),
							spectrumRGB: color.toDecimal(),
						},
					},
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
		public get traits(): SMART_HOME_DEVICE_TRAIT[] {
			return [...super.traits, SMART_HOME_DEVICE_TRAIT.BRIGHTNESS];
		}

		public get attributes(): SmartHomeAttributes<SMART_HOME_DEVICE_TRAIT.BRIGHTNESS> {
			return {
				...super.attributes,
				// commandOnlyBrightness: true,
			};
		}

		public get queryFunctions() {
			return [
				...super.queryFunctions,
				async (
					hookables: ModuleHookables
				): Promise<
					SmartHomeQuery<SMART_HOME_DEVICE_TRAIT.BRIGHTNESS>
				> => {
					const brightness = await (
						await hookables.RGB.getClient(
							this._queryID as LED_NAMES
						)
					)?.getBrightness();
					if (!brightness) {
						return {};
					}
					return {
						brightness,
					};
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

		public async execute(
			command: SMART_HOME_COMMAND,
			params: {},
			hookables: ModuleHookables
		): Promise<ExecuteReturnType<SMART_HOME_DEVICE_TRAIT.BRIGHTNESS>> {
			const superResult = await super.execute(command, params, hookables);
			if (
				command !== SMART_HOME_COMMAND.BRIGHTNESS_ABSOLUTE &&
				command !== SMART_HOME_COMMAND.BRIGHTNESS_RELATIVE
			) {
				return superResult;
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
				} else {
					return this._executeBrightnessRelative(
						params as SmartHomeParam<SMART_HOME_COMMAND.BRIGHTNESS_RELATIVE>,
						hookables
					);
				}
			})();
			if (!success) {
				return {
					success: false,
				};
			}

			return {
				success: true,
				mergeWithQuery: {
					...superResult.mergeWithQuery,
					brightness: newBrightness,
				},
			};
		}

		public async attachHomeGraphListeners(
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
					data: {
						brightness,
					},
				});
			});
		}
	}
	return SmartHomeBrightness;
}

export function SmartHomeMixinScene<
	C extends abstract new (...args: unknown[]) => {}
>(Constructor: C) {
	// @ts-ignore
	abstract class SmartHomeScene extends (Constructor as typeof SmartHomeDevice) {
		public get traits(): SMART_HOME_DEVICE_TRAIT[] {
			return [...super.traits, SMART_HOME_DEVICE_TRAIT.SCENE];
		}

		public get attributes(): SmartHomeAttributes<SMART_HOME_DEVICE_TRAIT.SCENE> {
			return {
				...super.attributes,
				sceneReversible: true,
			};
		}

		public async execute(
			command: SMART_HOME_COMMAND,
			params: SmartHomeParam<SMART_HOME_COMMAND.ACTIVATE_SCENE>,
			hookables: ModuleHookables
		): Promise<ExecuteReturnType<SMART_HOME_DEVICE_TRAIT.SCENE>> {
			const superResult = await super.execute(command, params, hookables);
			if (command !== SMART_HOME_COMMAND.ACTIVATE_SCENE) {
				return superResult;
			}
			if (!superResult.success) {
				return superResult;
			}

			return {
				success: await hookables.keyval.set(
					this._queryID,
					!params.deactivate ? '1' : '0'
				),
				mergeWithQuery: {
					...superResult.mergeWithQuery,
				},
			};
		}

		/**
		 * Currently disabled since this is not yet supported by Google
		 * (https://developers.google.com/assistant/smarthome/traits/scene)
		 */
		// public async attachHomeGraphListeners(
		// 	hookables: ModuleHookables,
		// 	callback: SmartHomeDeviceUpdateCallback<SMART_HOME_DEVICE_TRAIT.SCENE>
		// ) {
		// 	hookables.keyval.onChange(this._queryID, (value) => {
		// 		callback({
		// 			id: this.id,
		// 			data: {
		// 				on: value === '1',
		// 			},
		// 		});
		// 	});
		// }
	}
	return SmartHomeScene;
}

export function SmartHomeMixinTemperatureControl<
	C extends abstract new (...args: unknown[]) => {}
>(Constructor: C) {
	// @ts-ignore
	abstract class SmartHomeTemperatureControl extends (Constructor as typeof SmartHomeDevice) {
		public get traits(): SMART_HOME_DEVICE_TRAIT[] {
			return [
				...super.traits,
				SMART_HOME_DEVICE_TRAIT.TEMPERATURE_CONTROL,
			];
		}

		public get attributes(): SmartHomeAttributes<SMART_HOME_DEVICE_TRAIT.TEMPERATURE_CONTROL> {
			return {
				...super.attributes,
				temperatureRange: {
					minThresholdCelcius: 0,
					maxThresholdCelcius: 100,
				},
				temperatureStepCelsius: 0.1,
				temperatureUnitForUX: 'C',
				// queryOnlyTemperatureControl: true,
			};
		}

		public get queryFunctions() {
			return [
				...super.queryFunctions,
				async (
					hookables: ModuleHookables
				): Promise<
					SmartHomeQuery<SMART_HOME_DEVICE_TRAIT.TEMPERATURE_CONTROL>
				> => {
					return {
						temperatureAmbientCelsius: (
							await hookables.temperature.getTemp(this._queryID)
						).temp,
					};
				},
			];
		}

		public async execute(
			command: SMART_HOME_COMMAND,
			params: SmartHomeParam<SMART_HOME_COMMAND.SET_TEMPERATURE>,
			hookables: ModuleHookables
		): Promise<
			ExecuteReturnType<SMART_HOME_DEVICE_TRAIT.TEMPERATURE_CONTROL>
		> {
			const superResult = await super.execute(command, params, hookables);
			if (command !== SMART_HOME_COMMAND.SET_TEMPERATURE) {
				return superResult;
			}
			if (!superResult.success) {
				return superResult;
			}

			warning('Setting of temperature not supported');
			return {
				success: false,
			};
		}

		public async attachHomeGraphListeners(
			hookables: ModuleHookables,
			callback: SmartHomeDeviceUpdateCallback<SMART_HOME_DEVICE_TRAIT.TEMPERATURE_CONTROL>
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
						data: {
							temperatureAmbientCelsius: lastTemp,
						},
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

export function SmartHomeMixinTemperatureSetting<
	C extends abstract new (...args: unknown[]) => {}
>(Constructor: C) {
	// @ts-ignore
	abstract class SmartHomeTemperatureControl extends (Constructor as typeof SmartHomeDevice) {
		public get traits(): SMART_HOME_DEVICE_TRAIT[] {
			return [
				...super.traits,
				SMART_HOME_DEVICE_TRAIT.TEMPERATURE_SETTING,
			];
		}

		public get attributes(): SmartHomeAttributes<SMART_HOME_DEVICE_TRAIT.TEMPERATURE_SETTING> {
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

		public get queryFunctions() {
			return [
				...super.queryFunctions,
				async (
					hookables: ModuleHookables
				): Promise<
					SmartHomeQuery<SMART_HOME_DEVICE_TRAIT.TEMPERATURE_SETTING>
				> => {
					const temperature = (
						await hookables.temperature.getTemp(this._queryID)
					).temp;
					return {
						activeThermostatMode: 'none',
						thermostatMode: 'none',
						thermostatTemperatureSetpoint: temperature,
						thermostatTemperatureAmbient: temperature,
					};
				},
			];
		}

		public async execute(
			command: SMART_HOME_COMMAND,
			params: SmartHomeParam<SMART_HOME_COMMAND.SET_TEMPERATURE>,
			hookables: ModuleHookables
		): Promise<
			ExecuteReturnType<SMART_HOME_DEVICE_TRAIT.TEMPERATURE_SETTING>
		> {
			const superResult = await super.execute(command, params, hookables);
			if (command !== SMART_HOME_COMMAND.SET_TEMPERATURE) {
				return superResult;
			}
			if (!superResult.success) {
				return superResult;
			}

			warning('Setting of temperature not supported');
			return {
				success: false,
			};
		}

		public async attachHomeGraphListeners(
			hookables: ModuleHookables,
			callback: SmartHomeDeviceUpdateCallback<SMART_HOME_DEVICE_TRAIT.TEMPERATURE_SETTING>
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
						data: {
							activeThermostatMode: 'on',
							thermostatMode: 'on',
							thermostatTemperatureSetpoint: lastTemp,
							thermostatTemperatureAmbient: lastTemp,
						},
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
