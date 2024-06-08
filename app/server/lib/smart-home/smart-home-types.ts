/* eslint-disable @typescript-eslint/ban-types */

import type { QueryReturnType, SmartHomeDevice } from './smart-home-classes';

/**
 * A subset of the smart home device types
 */
export const enum GOOGLE_SMART_HOME_DEVICE_TYPE {
	OUTLET = 'action.devices.types.OUTLET',
	SPEAKER = 'action.devices.types.SPEAKER',
	RADIATOR = 'action.devices.types.RADIATOR',
	SENSOR = 'action.devices.types.SENSOR',
	SCENE = 'action.devices.types.SCENE',
	LIGHT = 'action.devices.types.LIGHT',
	THERMOSTAT = 'action.devices.types.THERMOSTAT',
	CURTAIN = 'action.devices.types.CURTAIN',
}
/**
 * A subset of samsung smartthings device types
 */
export const enum SAMSUNG_SMART_HOME_DEVICE_TYPE {
	SWITCH = 'c2c-switch',
	SPEAKER = 'c2c-speaker',
	RADIATOR = 'c2c-radiator',
	THERMOSTAT = 'c2c-humidity',
}
/**
 * A subset of the smart home device types
 */
export const enum SMART_HOME_DEVICE_TRAIT {
	COLOR_SETTING,
	BRIGHTNESS,
	SAMSUNG_BRIGHTNESS,
	// TEMPERATURE_CONTROL,
	TEMPERATURE_SETTING_AND_READING,
	// SCENE,
	ON_OFF,
	OPEN_CLOSE,
}

export const GOOGLE_SMART_HOME_DEVICE_TRAITS: {
	[K in SMART_HOME_DEVICE_TRAIT]: string | undefined;
} = {
	[SMART_HOME_DEVICE_TRAIT.COLOR_SETTING]:
		'action.devices.traits.ColorSetting',
	[SMART_HOME_DEVICE_TRAIT.BRIGHTNESS]: 'action.devices.traits.Brightness',
	// [SMART_HOME_DEVICE_TRAIT.TEMPERATURE_CONTROL]:
	// 	'action.devices.traits.TemperatureControl',
	[SMART_HOME_DEVICE_TRAIT.TEMPERATURE_SETTING_AND_READING]:
		'action.devices.traits.TemperatureSetting',
	// [SMART_HOME_DEVICE_TRAIT.MODES]: 'action.devices.traits.Modes',
	// [SMART_HOME_DEVICE_TRAIT.SCENE]: 'action.devices.traits.Scene',
	[SMART_HOME_DEVICE_TRAIT.ON_OFF]: 'action.devices.traits.OnOff',
	[SMART_HOME_DEVICE_TRAIT.SAMSUNG_BRIGHTNESS]: undefined,
	[SMART_HOME_DEVICE_TRAIT.OPEN_CLOSE]: 'action.devices.traits.OpenClose',
};

export const SAMSUNG_SMART_HOME_DEVICE_CAPABILITIES: {
	[K in SMART_HOME_DEVICE_TRAIT]: string | undefined;
} = {
	[SMART_HOME_DEVICE_TRAIT.COLOR_SETTING]: 'st.colorControl',
	[SMART_HOME_DEVICE_TRAIT.BRIGHTNESS]: 'st.switchLevel',
	[SMART_HOME_DEVICE_TRAIT.SAMSUNG_BRIGHTNESS]: 'st.switchLevel',
	[SMART_HOME_DEVICE_TRAIT.TEMPERATURE_SETTING_AND_READING]:
		'st.temperatureMeasurement',
	[SMART_HOME_DEVICE_TRAIT.ON_OFF]: 'st.switch',
	[SMART_HOME_DEVICE_TRAIT.OPEN_CLOSE]: 'st.switch',
};

/**
 * A subset of the commands sent by google home
 */
export const enum SMART_HOME_COMMAND {
	// Google
	ON_OFF = 'action.devices.commands.OnOff',
	COLOR_ABSOLUTE = 'action.devices.commands.ColorAbsolute',
	BRIGHTNESS_ABSOLUTE = 'action.devices.commands.BrightnessAbsolute',
	BRIGHTNESS_RELATIVE = 'action.devices.commands.BrightnessRelative',
	SET_TEMPERATURE = 'action.devices.commands.SetTemperature',
	SET_MODES = 'action.devices.commands.SetModes',
	ACTIVATE_SCENE = 'action.devices.commands.ActivateScene',
	THERMOSTAT_TEMPERATURE_SETPOINT = 'action.devices.commands.ThermostatTemperatureSetpoint',
	OPEN_CLOSE = 'action.devices.commands.OpenClose',

	// Samsung
	SWITCH_OFF = 'off',
	SWITCH_ON = 'on',
	COLOR_CONTROL_SET_COLOR = 'setColor',
	COLOR_CONTROL_SET_HUE = 'setHue',
	COLOR_CONTROL_SET_SATURATION = 'setSaturation',
	SWITCH_SET_LEVEL = 'setLevel',
}

type ColorState =
	| {
			temperatureK: number;
	  }
	| {
			/**
			 * The hex RGB representation of a number
			 * (for example FF00FF) as a decimal digit
			 */
			spectrumRgb: number;
	  }
	| {
			spectrumRGB: number;
	  }
	| {
			spectrumHsv: {
				hue?: number;
				saturation?: number;
				value?: number;
			};
	  }
	| {
			spectrumHSV: {
				hue?: number;
				saturation?: number;
				value?: number;
			};
	  };

type ThermostatMode =
	| 'off'
	| 'heat'
	| 'cool'
	| 'on'
	| 'heatcool'
	| 'auto'
	| 'fan-only'
	| 'purifier'
	| 'eco'
	| 'dry';

export type SmartHomeGoogleQuery<TR extends SMART_HOME_DEVICE_TRAIT> =
	(TR extends SMART_HOME_DEVICE_TRAIT.COLOR_SETTING
		? {
				color: ColorState;
			}
		: {}) &
		(TR extends SMART_HOME_DEVICE_TRAIT.BRIGHTNESS
			? {
					/**
					 * The brightness as a number between 0 and 100
					 */
					brightness?: number;
				}
			: {}) &
		(TR extends SMART_HOME_DEVICE_TRAIT.TEMPERATURE_SETTING_AND_READING
			? {
					activeThermostatMode: ThermostatMode | 'none';
					targetTempReachedEstimateUnixTimestampSec?: number;
					thermostatHumidityAmbient?: number;
				} & (
					| {
							thermostatMode: ThermostatMode | 'none';
							thermostatTemperatureAmbient: number;
							thermostatTemperatureSetpoint: number;
					  }
					| {
							thermostatMode: ThermostatMode | 'none';
							thermostatTemperatureAmbient: number;
							thermostatTemperatureSetpointHigh: number;
							thermostatTemperatureSetpointLow: number;
					  }
				)
			: {}) &
		(TR extends SMART_HOME_DEVICE_TRAIT.ON_OFF
			? {
					on?: boolean;
				}
			: {}) &
		(TR extends SMART_HOME_DEVICE_TRAIT.OPEN_CLOSE
			? {
					openPercent?: number;
				}
			: {});

export type SmartHomeSamsungQuery<TR extends SMART_HOME_DEVICE_TRAIT> =
	(TR extends SMART_HOME_DEVICE_TRAIT.COLOR_SETTING
		? {
				hue: number;
				saturation: number;
			}
		: {}) &
		(TR extends
			| SMART_HOME_DEVICE_TRAIT.BRIGHTNESS
			| SMART_HOME_DEVICE_TRAIT.SAMSUNG_BRIGHTNESS
			? {
					/**
					 * The brightness as a number between 0 and 100
					 */
					level: number;
				}
			: {}) &
		(TR extends SMART_HOME_DEVICE_TRAIT.TEMPERATURE_SETTING_AND_READING
			? {
					temperature: number;
					unit: 'C' | 'F';
				}
			: {}) &
		(TR extends SMART_HOME_DEVICE_TRAIT.ON_OFF
			? {
					switch: 'on' | 'off';
				}
			: {});

export type SmartHomeAttributes<TR extends SMART_HOME_DEVICE_TRAIT> =
	(TR extends SMART_HOME_DEVICE_TRAIT.COLOR_SETTING
		? {
				colorModel?: 'rgb' | 'hsv';
				colorTemperatureRange?: {
					temperatureMinK: number;
					temperatureMaxK: number;
				};
			}
		: {}) &
		(TR extends SMART_HOME_DEVICE_TRAIT.BRIGHTNESS
			? {
					commandOnlyBrightness?: boolean;
				}
			: {}) &
		(TR extends SMART_HOME_DEVICE_TRAIT.TEMPERATURE_SETTING_AND_READING
			? {
					availableThermostatModes: ThermostatMode[];
					thermostatTemperatureRange?: {
						minThresholdCelcius: number;
						maxThresholdCelcius: number;
					};
					thermostatTemperatureUnit: 'C' | 'F';
					bufferRangeCelsius?: number;
					commandOnlyTemperatureSetting?: boolean;
					queryOnlyTemperatureSetting?: boolean;
				}
			: {}) &
		(TR extends SMART_HOME_DEVICE_TRAIT.ON_OFF
			? {
					commandOnlyOnOff?: boolean;
					queryOnlyOnOff?: boolean;
				}
			: {}) &
		(TR extends SMART_HOME_DEVICE_TRAIT.OPEN_CLOSE
			? {
					commandOnlyOpenClose?: boolean;
					queryOnlyOpenClose?: boolean;
					openDirection?: (
						| 'UP'
						| 'DOWN'
						| 'LEFT'
						| 'RIGHT'
						| 'IN'
						| 'OUT'
					)[];
				}
			: {});

export type SmartHomeParam<TR extends SMART_HOME_COMMAND> =
	(TR extends SMART_HOME_COMMAND.COLOR_ABSOLUTE
		? {
				color: {
					name?: string;
				} & ColorState;
			}
		: {}) &
		(TR extends SMART_HOME_COMMAND.BRIGHTNESS_ABSOLUTE
			? {
					/**
					 * The brightness as a number between 0 and 100
					 */
					brightness: number;
				}
			: {}) &
		(TR extends SMART_HOME_COMMAND.BRIGHTNESS_RELATIVE
			?
					| {
							/**
							 * The brightness as a number between 0 and 100
							 */
							brightnessRelativePercent: number;
					  }
					| {
							/**
							 * This indicates the ambiguous amount of the brightness change.
							 * From small amount to large amount,
							 * this param will be scaled to integer 0 to 5,
							 * with the sign to indicate direction.
							 */
							brightnessRelativeWeight: number;
					  }
			: {}) &
		(TR extends SMART_HOME_COMMAND.SET_TEMPERATURE
			? {
					temperature: number;
				}
			: {}) &
		(TR extends SMART_HOME_COMMAND.SET_MODES
			? {
					updateModeSettings: {
						[modeName: string]: string;
					};
				}
			: {}) &
		(TR extends SMART_HOME_COMMAND.THERMOSTAT_TEMPERATURE_SETPOINT
			? {
					thermostatTemperatureSetpoint: number;
				}
			: {}) &
		(TR extends SMART_HOME_COMMAND.OPEN_CLOSE
			? {
					openPercent: number;
					openDirection?:
						| 'UP'
						| 'DOWN'
						| 'LEFT'
						| 'RIGHT'
						| 'IN'
						| 'OUT';
					followUpToken: string;
				}
			: {}) &
		(TR extends SMART_HOME_COMMAND.ACTIVATE_SCENE
			? {
					/**
					 * True to cancel a scene, false to activate a scene
					 */
					deactivate: boolean;
				}
			: {}) &
		(TR extends SMART_HOME_COMMAND.ON_OFF
			? {
					on: boolean;
				}
			: {}) &
		(TR extends SMART_HOME_COMMAND.SWITCH_OFF ? [] : []) &
		(TR extends SMART_HOME_COMMAND.SWITCH_ON ? [] : []) &
		(TR extends SMART_HOME_COMMAND.COLOR_CONTROL_SET_COLOR
			? [
					color:
						| {
								hex: string;
						  }
						| {
								hue: number;
								saturation: number;
						  },
				]
			: []) &
		(TR extends SMART_HOME_COMMAND.COLOR_CONTROL_SET_HUE
			? [hue: number]
			: []) &
		(TR extends SMART_HOME_COMMAND.COLOR_CONTROL_SET_SATURATION
			? [saturation: number]
			: []) &
		(TR extends SMART_HOME_COMMAND.SWITCH_SET_LEVEL
			? [level: number, rate: number]
			: []);

export interface SmartHomeDeviceSync {
	id: string;
	googleType: GOOGLE_SMART_HOME_DEVICE_TYPE;
	samsungType: SAMSUNG_SMART_HOME_DEVICE_TYPE;
	traits: SMART_HOME_DEVICE_TRAIT[];
	name: string;
	nicknames: string[];
	willReportState: boolean;
	attributes?: {};
	self: SmartHomeDevice;
}

export type SmartHomeDeviceUpdateCallback<
	T extends SMART_HOME_DEVICE_TRAIT = SMART_HOME_DEVICE_TRAIT,
> = (data: SmartHomeDeviceUpdate<T>) => void;

export type SmartHomeDeviceUpdate<T extends SMART_HOME_DEVICE_TRAIT> = {
	id: string;
	data: QueryReturnType<T>;
};
