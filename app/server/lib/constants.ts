import { Color } from '../modules/rgb';
import * as path from 'path';
import { getEnv, getNumberEnv } from './io';

const ROOT = path.join(__dirname, '../../../');
export const DB_FOLDER = path.join(ROOT, 'database');

// Secret stuff
export const SECRETS_FOLDER = path.join(ROOT, 'secrets');

// Logging
export const IP_LOG_VERSION: 'ipv4' | 'ipv6' = 'ipv6';

// Bots
export const TELEGRAM_IPS = [
	{
		start: [149, 154],
		lower: [160, 0],
		upper: [175, 255]
	},
	{
		start: [91, 108],
		lower: [4, 0],
		upper: [7, 255]
	}
];
export const TELEGRAM_API = 'api.telegram.org';

// Serial
export const LED_DEVICE_NAME = getEnv('MODULE_LED_DEVICE_NAME', true);

// Rgb
export const enum LED_NAMES {
	BED_LEDS,
	DESK_LEDS,
	CEILING_LEDS
}
export const MAGIC_LEDS = [LED_NAMES.BED_LEDS, LED_NAMES.DESK_LEDS];
export const ARDUINO_LEDS = [LED_NAMES.CEILING_LEDS];
export const LED_IPS: {
	[key: string]: LED_NAMES;
} = {
	[getEnv('MODULE_LED_DESK_LED_IP', true)]: LED_NAMES.DESK_LEDS,
	[getEnv('MODULE_LED_BED_LED_IP', true)]: LED_NAMES.BED_LEDS
};
export const NAME_MAP = {
	[getEnv('MODULE_LED_DESK_LED_IP', true)]: ['room.leds.desk'],
	[getEnv('MODULE_LED_BED_LED_IP', true)]: [
		'room.leds.bed',
		'room.lights.nightstand',
		'room.leds.wakelight'
	],
	[LED_DEVICE_NAME as string]: ['room.leds.ceiling']
};
export const NIGHTSTAND_COLOR: Color = (() => {
	const [r, g, b] = getEnv('MODULE_LED_NIGHTSTAND_COLOR', true).split(',');
	return { r: ~~r, g: ~~g, b: ~~b };
})();
export const WAKELIGHT_TIME = getNumberEnv('MODULE_LED_WAKELIGHT_TIME', true);

// Keyval
export const MAIN_LIGHTS = (() => {
	const str = getEnv('MODULE_LED_MAIN_LIGHTS', true);
	if (!str) return [];
	return str.split(',');
})();
export const COMMON_SWITCH_MAPPINGS: [RegExp, string][] = [
	[/((ceiling|the|my)\s+)?light/, 'room.lights.ceiling'],
	[/((the)\s+)?lights/, 'room.lights.ceiling'],
	[
		/((the|my)\s+)?(nightlight|(nightstand\s*light))/,
		'room.lights.nightstand'
	],
	[/all\s+lights/, 'room.lights'],
	[/((all|the|my)\s+)?speakers/, 'room.speakers'],
	[/((the|my)\s+)?couch\s+speakers/, 'room.speakers.couch'],
	[/((the|my)\s+)?desk\s+speakers/, 'room.speakers.desk']
];

// Cast
export const CAST_DEVICE_NAME = getEnv('CAST_DEVICE_NAME', true);

// Pressure
export const MIN_PRESSURE = 0;
export const MAX_PRESSURE = 1024;
export const DEFAULT_MIN_TIME = 500;
export const PRESSURE_SAMPLE_TIME = 500;
export const MAX_PRESSURE_TIME = 10000;

// Spotify
export const PLAYSTATE_CHECK_INTERVAL = 1000;
export const BEAT_CACHE_CLEAR_INTERVAL = 1000 * 60 * 60;
export const PLAYBACK_CLOSE_RANGE = 10;
export const MAX_BEATS_ARR_LENGTH = 2000;
