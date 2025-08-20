import * as dotenv from 'dotenv';

type NumArg = `${number}`;
type BoolArg = '1' | 'true';

interface Args {
	http?: NumArg;
	https?: NumArg;
	'info-port'?: string;

	'log-secrets'?: BoolArg;
	'ignore-pressure'?: BoolArg;
	'error-log-path'?: string;
	'log-telegram-bot-commands'?: BoolArg;

	IO_DEBUG?: string;
	debug?: BoolArg;
	instant?: BoolArg;
	verbose?: BoolArg;
	veryverbose?: BoolArg;
	'verbose*'?: BoolArg;

	help?: BoolArg;
}

const getEnvironmentVariables = (() => {
	let loaded = false;
	return () => {
		if (!loaded) {
			dotenv.config({
				// eslint-disable-next-line @typescript-eslint/no-var-requires
				path: (require('path') as typeof import('path')).join(
					__dirname,
					'../../../',
					'.env'
				),
			});
			loaded = true;
		}
		return process.env;
	};
})();

export function getArg(name: keyof Args, short?: string): string | void {
	for (let i = 0; i < process.argv.length; i++) {
		if (process.argv[i] === `--${name}`) {
			return process.argv[i + 1];
		} else if (short && process.argv[i] === `--${short}`) {
			return process.argv[i + 1];
		} else if (process.argv[i].startsWith(`--${name}=`)) {
			return process.argv[i].slice(3 + name.length);
		}
	}
	return void 0;
}

export function hasArg(name: keyof Args, short?: string): boolean | undefined {
	for (let i = 0; i < process.argv.length; i++) {
		if (process.argv[i] === `--${name}`) {
			return true;
		} else if (short && process.argv[i] === `-${short}`) {
			return true;
		} else if (process.argv[i].startsWith(`--${name}=`)) {
			return true;
		}
	}
	return void 0;
}

export function getNumberArg(name: keyof Args): number | void {
	const arg = getArg(name);
	if (arg === void 0) {
		return void 0;
	}
	return ~~arg;
}

export interface EnvShape {
	// IO
	IO_PORT_HTTP: NumArg;
	IO_PORT_HTTPS: NumArg;
	IO_PORT_INFO: string;
	IO_UID: NumArg;
	IO_DEBUG: BoolArg;

	// LED IPs
	SELF_IP: string;

	// Secrets
	SECRET_AUTH: string;
	SECRET_BOT: string;
	SECRET_REMOTE_CONTROL: string;
	SECRET_OAUTH_TOKEN_URL_POSTFIX: string;

	SECRET_GOOGLE_CLIENT_ID: string;
	SECRET_GOOGLE_CLIENT_SECRET: string;
	SECRET_GOOGLE_REDIRECT_URL: string;

	SECRET_SAMSUNG_REDIRECT_URI: string;
	SECRET_SAMSUNG_APP_ID: string;
	SECRET_SAMSUNG_CLIENT_ID: string;
	SECRET_SAMSUNG_CLIENT_SECRET: string;
	SECRET_SAMSUNG_URL_POSTFIX: string;

	SECRET_OPENWEATHERMAP_API_KEY: string;
	SECRET_OPENWEATHERMAP_LAT: string;
	SECRET_OPENWEATHERMAP_LON: string;
	SECRET_OPENWEATHERMAP_UNITS: string;

	SECRET_SPOTIFY_ID: string;
	SECRET_SPOTIFY_SECRET: string;
	SECRET_SPOTIFY_REDIRECT_URL_BASE: string;

	SECRET_EWELINK_APP_ID: string;
	SECRET_EWELINK_APP_SECRET: string;
	SECRET_EWELINK_REGION: string;
	SECRET_EWELINK_EMAIL: string;
	SECRET_EWELINK_PASSWORD: string;
	SECRET_EWELINK_AREA_CODE: string;
	SECRET_EWELINK_REDIRECT_URL_BASE: string;

	SECRET_NOTION_API_KEY: string;

	SECRET_HUE_USERNAME: string;

	SECRET_SENTRY_DSN: string;
}

export function getEnv<S extends EnvShape>(
	name: Extract<keyof S, string>
): string | void;
export function getEnv<S extends EnvShape>(
	name: Extract<keyof S, string>,
	required: false
): string | void;
export function getEnv<S extends EnvShape>(
	name: Extract<keyof S, string>,
	required: true
): string;
export function getEnv<S extends EnvShape>(
	name: Extract<keyof S, string>,
	required: boolean
): string | void;
export function getEnv<S extends EnvShape>(
	name: Extract<keyof S, string>,
	required = false
): string | void {
	const value = getEnvironmentVariables()[name];
	if (value === void 0) {
		if (!required) {
			return void 0;
		}
		console.log(`Missing env variable "${name}"`);
		// eslint-disable-next-line no-process-exit
		process.exit(1);
	}
	return value;
}

export function getNumberEnv<S extends EnvShape>(
	name: Extract<keyof S, string>
): number | void;
export function getNumberEnv<S extends EnvShape>(
	name: Extract<keyof S, string>,
	required: false
): number | void;
export function getNumberEnv<S extends EnvShape>(
	name: Extract<keyof S, string>,
	required: true
): number;
export function getNumberEnv<S extends EnvShape>(
	name: Extract<keyof S, string>,
	required = false
): number | void {
	const value = getEnv(name, required);
	if (typeof value !== 'string') {
		return value;
	}
	return ~~value;
}
