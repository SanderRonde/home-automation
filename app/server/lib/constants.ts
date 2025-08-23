import * as path from 'path';

export const ROOT = path.join(__dirname, '../../../');
export const CLIENT_FOLDER = path.join(ROOT, 'app/client');
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
		upper: [175, 255],
	},
	{
		start: [91, 108],
		lower: [4, 0],
		upper: [7, 255],
	},
];
export const TELEGRAM_API = 'api.telegram.org';

// Ewelink
export const EWELINK_DEBUG = true;
