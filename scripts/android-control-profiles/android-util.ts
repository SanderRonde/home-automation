import * as child_process from 'child_process';
import chalk from 'chalk';

export function $(command: string, stdin?: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const proc = child_process.exec(command, (error, stdout) => {
			if (error) {
				reject(error);
			} else {
				resolve(stdout);
			}
		});
		if (stdin) {
			proc.stdin?.write(stdin);
			proc.stdin?.end();
		}
	});
}

export async function adb$(device: string, command: string): Promise<string> {
	return $(`adb -s ${device} ${command}`);
}

export function log(emoji: string, text0: unknown, ...text: unknown[]): void {
	console.log(emoji, ...[text0, ...text].map((t) => (typeof t === 'string' ? chalk.cyan(t) : t)));
}

export function exit(emoji: string, text0: unknown, ...text: unknown[]): never {
	console.log(emoji, ...[text0, ...text].map((t) => (typeof t === 'string' ? chalk.red(t) : t)));
	process.exit(1);
}

export function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
