/* eslint-disable @typescript-eslint/ban-types */
/**
 * A subset of the smart home device types
 */
export const enum SMART_HOME_DEVICE_TYPE {
	OUTLET = 'action.devices.types.OUTLET',
	SPEAKER = 'action.devices.types.SPEAKER',
	RADIATOR = 'action.devices.types.RADIATOR',
	SENSOR = 'action.devices.types.SENSOR',
	SCENE = 'action.devices.types.SCENE',
	LIGHT = 'action.devices.types.LIGHT',
	THERMOSTAT = 'action.devices.types.THERMOSTAT',
}
/**
 * A subset of the smart home device types
 */
export const enum SMART_HOME_DEVICE_TRAIT {
	COLOR_SETTING = 'action.devices.traits.ColorSetting',
	BRIGHTNESS = 'action.devices.traits.Brightness',
	TEMPERATURE_CONTROL = 'action.devices.traits.TemperatureControl',
	TEMPERATURE_SETTING = 'action.devices.traits.TemperatureSetting',
	MODES = 'action.devices.traits.Modes',
	SCENE = 'action.devices.traits.Scene',
	ON_OFF = 'action.devices.traits.OnOff',
}

/**
 * A subset of the commands sent by google home
 */
export const enum SMART_HOME_COMMAND {
	ON_OFF = 'action.devices.commands.OnOff',
	COLOR_ABSOLUTE = 'action.devices.commands.ColorAbsolute',
	BRIGHTNESS_ABSOLUTE = 'action.devices.commands.BrightnessAbsolute',
	BRIGHTNESS_RELATIVE = 'action.devices.commands.BrightnessRelative',
	SET_TEMPERATURE = 'action.devices.commands.SetTemperature',
	SET_MODES = 'action.devices.commands.SetModes',
	ACTIVATE_SCENE = 'action.devices.commands.ActivateScene',
	THERMOSTAT_TEMPERATURE_SETPOINT = 'action.devices.commands.ThermostatTemperatureSetpoint',
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
			spectrumRGB: number;
	  }
	| {
			spectrumHsv: {
				hue?: number;
				saturation?: number;
				value?: number;
			};
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

export type SmartHomeQuery<TR extends SMART_HOME_DEVICE_TRAIT> =
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
		(TR extends SMART_HOME_DEVICE_TRAIT.TEMPERATURE_CONTROL
			? {
					// The target temperature
					temperatureSetpointCelsius?: number;
					// The actual temperature
					temperatureAmbientCelsius?: number;
			  }
			: {}) &
		(TR extends SMART_HOME_DEVICE_TRAIT.TEMPERATURE_SETTING
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
		(TR extends SMART_HOME_DEVICE_TRAIT.MODES
			? {
					/**
					 * An object with the key being the mode name
					 * and the value being the value of the mode.
					 * So for example {
					 * 	effect: 'rainbow'
					 * }
					 */
					[modeName: string]: string;
			  }
			: {}) &
		(TR extends SMART_HOME_DEVICE_TRAIT.SCENE ? {} : {}) &
		(TR extends SMART_HOME_DEVICE_TRAIT.ON_OFF
			? {
					on?: boolean;
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
		(TR extends SMART_HOME_DEVICE_TRAIT.TEMPERATURE_CONTROL
			? {
					temperatureRange: {
						minThresholdCelcius: number;
						maxThresholdCelcius: number;
					};
					temperatureStepCelsius?: number;
					temperatureUnitForUX: 'C' | 'F';
					commandOnlyTemperatureControl?: boolean;
					queryOnlyTemperatureControl?: boolean;
			  }
			: {}) &
		(TR extends SMART_HOME_DEVICE_TRAIT.TEMPERATURE_SETTING
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
		(TR extends SMART_HOME_DEVICE_TRAIT.MODES
			? {
					availableModes: {
						name: string;
						name_values: {
							name_synonym: string;
							lang: string;
						}[];
						settings: {
							setting_name: string;
							setting_values: {
								setting_synonym: string;
								lang: string;
							}[];
						}[];
						ordered?: boolean;
					}[];
					commandOnlyModes?: boolean;
					queryOnlyModes?: boolean;
			  }
			: {}) &
		(TR extends SMART_HOME_DEVICE_TRAIT.SCENE
			? {
					sceneReversible?: boolean;
			  }
			: {}) &
		(TR extends SMART_HOME_DEVICE_TRAIT.ON_OFF
			? {
					commandOnlyOnOff?: boolean;
					queryOnlyOnOff?: boolean;
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
			: {});

export interface SmartHomeDeviceSync {
	id: string;
	type: SMART_HOME_DEVICE_TYPE;
	traits: SMART_HOME_DEVICE_TRAIT[];
	name: string;
	nicknames: string[];
	willReportState: boolean;
	attributes?: {};
}

export type SmartHomeDeviceUpdateCallback<
	T extends SMART_HOME_DEVICE_TRAIT = SMART_HOME_DEVICE_TRAIT
> = (data: SmartHomeDeviceUpdate<T>) => void;

export type SmartHomeDeviceUpdate<T extends SMART_HOME_DEVICE_TRAIT> = {
	id: string;
	data: SmartHomeQuery<T>;
};
