import { attachMessage, LogObj, logTag } from '@server/lib/logger';
import telnet_client, * as TelnetClient from 'telnet-client';
import { getEnv } from '@server/lib/io';
import { Commands } from '@server/modules/remote-control/types';
import chalk from 'chalk';

let TELNET_IPS: [string, string, string][] | null;
const connections: Map<
	string,
	{
		host: string;
		conn: telnet_client;
	}
> = new Map();

async function* getClients() {
	const preConnectVals = connections.values();

	const prom = Promise.all(
		TELNET_IPS!.map(async ([host, port, password]) => {
			if (connections.has(host)) {
				return;
			}

			const conn =
				new (TelnetClient as unknown as typeof telnet_client)();
			try {
				await conn.connect({
					host,
					port: parseInt(port, 10),
					password: password,
					debug: true,
					timeout: 1500,
					shellPrompt: '> ',
					username: '',
					initialLFCR: true,
				});
				logTag(
					'telnet',
					'cyan',
					chalk.bold(`Connected to host ${host}`)
				);
				connections.set(host, {
					host,
					conn,
				});
				return {
					host,
					conn,
				};
			} catch (err) {
				return;
			}
		})
	);

	for (const client of preConnectVals) {
		yield client;
	}

	for (const newConnection of await prom) {
		if (newConnection) {
			yield newConnection;
		}
	}
}

async function executeTelnetCommand(conn: telnet_client, command: Commands) {
	switch (command.action) {
		case 'close':
			return conn.send('quit');
		case 'pause':
			return conn.send('pause');
		case 'play':
			return conn.send('play');
		case 'playpause':
			return conn.send(
				(await conn.send('is_playing')) === '1' ? 'pause' : 'play'
			);
		case 'setVolume':
			return conn.send(`volume ${command.amount * 2.56}`);
		case 'volumeUp':
			return conn.send(
				`volume ${Math.min(
					320,
					parseInt(
						await conn.send('volume', {
							waitfor: /\d+/,
						}),
						10
					) +
						(command.amount || 10) * 2.56
				)}`
			);
		case 'volumeDown':
			return conn.send(
				`volume ${Math.max(
					0,
					parseInt(
						await conn.send('volume', {
							waitfor: /\d+/,
						}),
						10
					) -
						(command.amount || 10) * 2.56
				)}`
			);
	}
}

export async function sendMessage(
	command: Commands,
	logObj: LogObj
): Promise<void> {
	const gen = getClients();
	let next: IteratorResult<
		{
			host: string;
			conn: telnet_client;
		},
		void
	> | null = null;
	while ((next = await gen.next()) && !next.done) {
		void (async () => {
			try {
				attachMessage(
					logObj,
					`Executing telnet command: ${JSON.stringify(
						command
					)} on host ${next.value.host}`
				);
				await executeTelnetCommand(next.value.conn, command);
			} catch (e) {
				attachMessage(
					logObj,
					`Failed Executing telnet command: ${JSON.stringify(
						command
					)} on host ${next.value.host}`
				);
				// Remove connection
				connections.delete(next.value.host);
			}
		})();
	}
}

(() => {
	TELNET_IPS = getEnv('SECRET_REMOTE_CONTROL', true)
		.split('\n')
		.filter((l) => l.length)
		.map((l) => l.split(':')) as [string, string, string][];
})();
