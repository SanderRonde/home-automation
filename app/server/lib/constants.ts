import { Color } from '../modules/rgb';
import * as path from 'path';

const ROOT = path.join(__dirname, '../../../');
export const DB_FOLDER = path.join(ROOT, 'database');

// Secret stuff
export const SECRETS_FOLDER = path.join(ROOT, 'secrets');
export const AUTH_SECRET_FILE = path.join(SECRETS_FOLDER, 'auth.txt');
export const BOT_SECRET_FILE = path.join(SECRETS_FOLDER, 'bot.txt');

// Logging
export const IP_LOG_VERSION: 'ipv4'|'ipv6' = 'ipv6';

// Bots
export const TELEGRAM_IPS = [
	{
		start: [149, 154],
		lower: [160, 0],
		upper: [175, 255]
	}, {
		start: [91, 108],
		lower: [4, 0],
		upper: [7, 255]
	}
];
export const TELEGRAM_API = 'api.telegram.org';

// Serial
export const SERIAL_MSG_INTERVAL = 50;
export const SERIAL_MAX_ATTEMPTS = 10;
export const SCREEN_DEVICE_NAME = '/dev/ttyUSB0';
export const LED_DEVICE_NAME = '/dev/ttyACM0';

// Rgb
export const BED_LEDS = [
	'192.168.1.5',
];
export const NIGHTSTAND_COLOR: Color = {
	r: 177,
	g: 22,
	b: 0
};

// Keyval
export const MAIN_LIGHTS = ['room.lights.ceiling']
export const COMMON_SWITCH_MAPPINGS: [RegExp, string][] = [
	[/((ceiling|the|my)\s+)?light/, 'room.lights.ceiling'],
	[/((the)\s+)?lights/, 'room.lights.ceiling'],
	[/((the|my)\s+)?(nightlight|(nightstand\s*light))/, 'room.lights.nightstand'],
	[/all\s+lights/, 'room.lights'],
	[/((all|the|my)\s+)?speakers/, 'room.speakers'],
	[/((the|my)\s+)?couch\s+speakers/, 'room.speakers.couch'],
	[/((the|my)\s+)?desk\s+speakers/, 'room.speakers.desk']
];