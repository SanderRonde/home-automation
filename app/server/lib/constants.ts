import { Color } from '../modules/rgb';
import * as path from 'path';

const ROOT = path.join(__dirname, '../../../');
export const DB_FOLDER = path.join(ROOT, 'database');

// Secret stuff
export const SECRETS_FOLDER = path.join(ROOT, 'secrets');
export const AUTH_SECRET_FILE = path.join(SECRETS_FOLDER, 'auth.txt');
export const BOT_SECRET_FILE = path.join(SECRETS_FOLDER, 'bot.txt');
export const TELNET_IPS_FILE = path.join(SECRETS_FOLDER, 'telnet-ips.txt');
export const SPOTIFY_SECRETS_FILE = path.join(SECRETS_FOLDER, 'spotify.json');

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
export const LED_DEVICE_NAME = '/dev/ttyACM0';

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
	'192.168.1.2': LED_NAMES.BED_LEDS,
	'192.168.1.4': LED_NAMES.DESK_LEDS
};
export const NAME_MAP = {
	'192.168.1.2': [
		'room.leds.bed',
		'room.lights.nightstand',
		'room.leds.wakelight'
	],
	'192.168.1.4': ['room.leds.desk'],
	[LED_DEVICE_NAME]: ['room.leds.ceiling']
};
export const NIGHTSTAND_COLOR: Color = {
	r: 177,
	g: 22,
	b: 0
};
export const WAKELIGHT_TIME = 60 * 5 * 1000;

// Keyval
export const MAIN_LIGHTS = ['room.lights.ceiling'];
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
export const CAST_DEVICE_NAME = 'Home';

// Pressure
export const MIN_PRESSURE = 0;
export const MAX_PRESSURE = 1024;
export const DEFAULT_MIN_TIME = 1000;
export const PRESSURE_SAMPLE_TIME = 1000;
export const MAX_PRESSURE_TIME = 10000;

// Spotify
export const PLAYSTATE_CHECK_INTERVAL = 1000;
export const BEAT_CACHE_CLEAR_INTERVAL = 1000 * 60 * 60;
export const PLAYBACK_CLOSE_RANGE = 10;
export const MAX_BEATS_ARR_LENGTH = 2000;
