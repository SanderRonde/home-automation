import { exec } from 'child_process';
import * as https from 'https';

function getArg(name: string) {
	for (let i = 1; i < process.argv.length; i++) {
		if (process.argv[i] === `--${name}`) {
			return process.argv[i + 1];
		}
	}
	throw new Error(`Missing argument --${name}`);
}

function report(temperature: number) {
	const name = getArg('name');
	const req = https.request(
		{
			method: 'POST',
			hostname: getArg('host'),
			path: `/temperature/report/${name}/${temperature}`,
		},
		(res) => {
			if (res.statusCode === 200) {
				console.log(`Reported temperature ${temperature}`);
			} else {
				console.log('Failed to report temperature');
			}
		}
	);
	req.end();
}

function measure() {
	const device = getArg('device');
	exec(`sensors -u ${device}`, (err, stdout) => {
		if (err) {
			return;
		}

		for (const line of stdout.split('\n').slice(1)) {
			if (line.startsWith('  temp1_input:')) {
				const temperature = parseFloat(
					line.split(/\s/g).filter((l) => l.length)[1]
				);
				report(temperature);
				break;
			}
		}
	});
}

function main(): void {
	setInterval(() => {
		void measure();
	}, 1000 * 60);
	void measure();
}

main();
