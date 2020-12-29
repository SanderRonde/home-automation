#!/usr/bin/env node

// @ts-ignore
import * as ReadLine from '@serialport/parser-readline';
import * as SerialPort from 'serialport';
import * as readline from 'readline';

const readLine = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

function getIO() {
	let baud = 115200;
	let file = '/dev/ttyACM0';
	let input: string = '';
	let takeInput: boolean = false;

	for (let i = 0; i < process.argv.length; i++) {
		if (process.argv[i] === '-b') {
			baud = parseInt(process.argv[i + 1], 10);
			i++;
		} else if (process.argv[i] === '-f') {
			file = process.argv[i + 1];
			i++;
		} else if (process.argv[i] === '-c') {
			input = process.argv[i + 1];
		} else if (process.argv[i] === '-') {
			takeInput = true;
		}
	}

	return { baud, file, input, takeInput };
}

async function connect({
	baud,
	file,
	input,
	takeInput
}: {
	baud: number;
	file: string;
	input: string;
	takeInput: boolean;
}) {
	const port = new SerialPort(file, {
		baudRate: baud
	});
	port.on('error', e => {
		console.log('error', e);
		process.exit(1);
	});

	// @ts-ignore
	const parser = new ReadLine();
	port.pipe(parser);
	let showOutput: boolean = false;

	let buffered: string[] = [];
	parser.on('data', async (line: string) => {
		if (showOutput) {
			process.stdout.write(line + '\n');
		} else {
			buffered.push(line + '\n');
		}
	});

	if (input !== '') {
		setTimeout(() => {
			if (input.endsWith('\n')) {
				port.write(input);
			} else {
				port.write(input + '\n');
			}
			setTimeout(() => {
				process.exit(0);
			}, 100);
		}, 200);
		return;
	}

	while (true) {
		await new Promise(resolve => {
			readLine.question(
				showOutput ? '' : 'Enter command:\n> ',
				command => {
					if (
						command === 'exit' ||
						command === 'e' ||
						command === 'q' ||
						command === 'quit'
					) {
						process.exit(1);
					}
					if (command === 's') {
						showOutput = true;
						console.log('Showing output');
						buffered.forEach(line => {
							process.stdout.write(line);
						});
					} else if (command === 'h') {
						showOutput = false;
						console.log('Hiding output');
					} else {
						showOutput = true;
						port.write(command + '\n');
					}
					if (takeInput) {
						setTimeout(() => {
							process.exit(0);
						}, 100);
					} else {
						resolve();
					}
				}
			);
		});
	}
}

function main() {
	connect(getIO());
}

main();
