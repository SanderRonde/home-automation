export function getArg(name: string, short?: string): string | void {
	for (let i = 0; i < process.argv.length; i++) {
		if (process.argv[i] === `--${name}`) {
			return process.argv[i + 1];
		}
		else if (short && process.argv[i] === `--${short}`) {
			return process.argv[i + 1];
		}
		else if (process.argv[i].startsWith(`--${name}=`)) {
			return process.argv[i].slice(3 + name.length);
		}
	}
	return void 0;
}

export function hasArg(name: string, short?: string) {
	for (let i = 0; i < process.argv.length; i++) {
		if (process.argv[i] === `--${name}`) {
			return true;
		}
		else if (short && process.argv[i] === `-${short}`) {
			return true;
		}
		else if (process.argv[i].startsWith(`--${name}=`)) {
			return true;
		}
	}
	return void 0;
}

export function getNumberArg(name: string): number | void {
	const arg = getArg(name);
	if (arg === void 0)
		return void 0;
	return ~~arg;
}
