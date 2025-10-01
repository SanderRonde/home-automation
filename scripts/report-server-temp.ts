import { genId, getClientSecret } from '../app/server/modules/auth/client-secret';
import { logImmediate } from '../app/server/lib/logging/logger';
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

function report(temperature: number, id: number, secret: string) {
	const name = getArg('name');
	const req = https.request(
		{
			method: 'POST',
			hostname: getArg('host'),
			path: `/temperature/report/${name}/${temperature}?id=${id}&auth=${secret}`,
		},
		(res) => {
			if (res.statusCode === 200) {
				logImmediate(
					`[${new Date().toLocaleTimeString()}] Reported temperature ${temperature}`
				);
			} else {
				logImmediate(`[${new Date().toLocaleTimeString()}] Failed to report temperature`);
			}
		}
	);
	req.end();
}

function measure(id: number, secret: string) {
	const device = getArg('device');
	exec(`sensors -u ${device}`, (err, stdout) => {
		if (err) {
			return;
		}

		for (const line of stdout.split('\n').slice(1)) {
			if (line.startsWith('  temp1_input:')) {
				const temperature = parseFloat(line.split(/\s/g).filter((l) => l.length)[1]);
				report(temperature, id, secret);
				break;
			}
		}
	});
}

function main(): void {
	const id = genId();
	const secret = getClientSecret(id);
	setInterval(() => {
		void measure(id, secret);
	}, 1000 * 60);
	void measure(id, secret);
}

main();
