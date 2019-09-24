import * as path from 'path';

const ROOT = path.join(__dirname, '../../../');
export const DB_FOLDER = path.join(ROOT, 'database');

export const SECRETS_FOLDER = path.join(ROOT, 'secrets');
export const AUTH_SECRET_FILE = path.join(SECRETS_FOLDER, 'auth.txt');
export const BOT_SECRET_FILE = path.join(SECRETS_FOLDER, 'bot.txt');
export const IP_LOG_VERSION: 'ipv4'|'ipv6' = 'ipv6';
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