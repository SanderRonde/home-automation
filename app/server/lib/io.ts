export function getArg(name: string, short?: string): string | void {
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

export function hasArg(name: string, short?: string) {
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

export function getNumberArg(name: string): number | void {
	const arg = getArg(name);
	if (arg === void 0) return void 0;
	return ~~arg;
}

export function getEnv(name: string): string | void;
export function getEnv(name: string, required: false): string | void;
export function getEnv(name: string, required: true): string;
export function getEnv(name: string, required: boolean): string | void;
export function getEnv(name: string, required: boolean = false): string | void {
	const value = process.env[name];
	if (value === void 0) {
		if (!required) return void 0;
		console.log(`Missing env variable "${name}"`);
		process.exit(1);
	}
	return value;
}

export function getNumberEnv(name: string): number | void;
export function getNumberEnv(name: string, required: false): number | void;
export function getNumberEnv(name: string, required: true): number;
export function getNumberEnv(
	name: string,
	required: boolean = false
): number | void {
	const value = getEnv(name, required);
	if (typeof value !== 'string') return value;
	return ~~value;
}
