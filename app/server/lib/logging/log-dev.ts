import chalk from 'chalk';

export function logDev(...args: unknown[]): void {
	const stack = new Error().stack;
	const callerLine = stack?.split('\n')[2] || '';
	const match = callerLine.match(/at (.+):(\d+)/);
	const fileName = match ? match[1].split('/').pop() : 'unknown';
	const lineNumber = match ? match[2] : 'unknown';

	const timePrefixLength = `${new Date().toLocaleString()}`.length;
	const locationInfo = chalk.blue(`[${fileName}:${lineNumber}]`);
	const message = chalk.green('[LOG]');

	const totalLength = timePrefixLength;
	const debugText = 'DEBUG';
	const leftPadding = Math.floor((totalLength - debugText.length) / 2);
	const rightPadding = totalLength - debugText.length - leftPadding;

	console.log(
		chalk.bgWhite(
			chalk.black(
				`[${' '.repeat(leftPadding)}${debugText}${' '.repeat(rightPadding)}]`
			)
		),
		locationInfo,
		message,
		...args
	);
}
