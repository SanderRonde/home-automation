import chalk from 'chalk';

export function getTime(): string {
	return chalk.bold(`[${new Date().toLocaleString()}]`);
}

let signalLogReady: undefined | (() => void) = undefined;
const logIsReady = new Promise<void>((resolve) => {
	signalLogReady = resolve;
});
export function logReady(): void {
	signalLogReady?.();
}

type ChalkColor =
	| 'black'
	| 'red'
	| 'green'
	| 'yellow'
	| 'blue'
	| 'magenta'
	| 'cyan'
	| 'white'
	| 'gray'
	| 'grey'
	| 'blackBright'
	| 'redBright'
	| 'greenBright'
	| 'yellowBright'
	| 'blueBright'
	| 'magentaBright'
	| 'cyanBright'
	| 'whiteBright';

export function logImmediate(...args: unknown[]): void {
	// eslint-disable-next-line no-console
	console.log(...args);
}

function log(...args: unknown[]): void {
	void logIsReady.then(() => {
		// eslint-disable-next-line no-console
		console.log(...args);
	});
}

export function logTag(tag: string, color: ChalkColor, ...messages: unknown[]): void {
	log(getTime(), chalk[color](`[${tag}]`), ...messages);
}

export function warning(...messages: unknown[]): void {
	log(getTime(), chalk.bgRed('[WARNING]'), ...messages);
}
