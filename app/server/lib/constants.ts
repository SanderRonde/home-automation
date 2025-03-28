import * as path from 'path';

export const ROOT = path.join(__dirname, '../../../');
export const CLIENT_FOLDER = path.join(ROOT, 'app/client');
export const DB_FOLDER = path.join(ROOT, 'database');
const STATIC_FOLDER = path.join(ROOT, 'static');
export const MARKED_AUDIO_FOLDER = path.join(STATIC_FOLDER, 'marked_audio');

// Secret stuff
export const SECRETS_FOLDER = path.join(ROOT, 'secrets');

// Logging
export const IP_LOG_VERSION: 'ipv4' | 'ipv6' = 'ipv6';

// Bots
export const TELEGRAM_IPS = [
	{
		start: [149, 154],
		lower: [160, 0],
		upper: [175, 255],
	},
	{
		start: [91, 108],
		lower: [4, 0],
		upper: [7, 255],
	},
];
export const TELEGRAM_API = 'api.telegram.org';

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

// Smart-home
export const SMART_HOME_BATCH_MIN_TIMEOUT = 50;
export const SMART_HOME_BATCH_MAX_TIMEOUT = 5000;
export const TEMPERATURE_REPORT_MAX_TIMEOUT = 60000 * 5;

// Ewelink
export const EWELINK_DEBUG = true;

// Notion
export const NOTION_GEOCODE_UPDATE_INTERVAL = 1000 * 60 * 60;
