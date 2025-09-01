// Would be really nice to combine but for now Matter is broken in Bun:
// https://github.com/oven-sh/bun/issues/21547

import {
	MatterServerInputMessageType,
	MatterServerOutputMessageType,
	type MatterServerOutputMessage,
} from '../server/server';
import type {
	MatterDeviceInfo,
	MatterServerInputMessage,
	MatterServerInputReturnValues,
} from '../server/server';
import { DB_FOLDER, MATTER_DEBUG, ROOT } from '../../../lib/constants';
import type { ChildProcessWithoutNullStreams } from 'child_process';
import { logTag } from '../../../lib/logging/logger';
import type { EndpointNumber } from '@matter/types';
import { Data } from '../../../lib/data';
import { MatterDevice } from './device';
import { spawn } from 'child_process';
import * as path from 'path';

export class MatterClient implements Disposable {
	#requestIdentifier = 0;
	#proc: ChildProcessWithoutNullStreams | null = null;
	#listeners: Set<(message: MatterServerOutputMessage) => void> = new Set();

	public devices = new Data<Record<EndpointNumber, MatterDevice>>({});

	public constructor() {}

	#updateDevices(deviceInfos: MatterDeviceInfo[]) {
		const devices: Record<string, MatterDevice> = {};
		for (const deviceInfo of deviceInfos) {
			if (devices[deviceInfo.number]) {
				continue;
			}

			devices[deviceInfo.number] = new MatterDevice(
				deviceInfo.nodeId,
				deviceInfo.number,
				deviceInfo.label ?? deviceInfo.name,
				this,
				deviceInfo.clusterMeta,
				deviceInfo.endpoints
			);
		}
		this.devices.set(devices);
	}

	public start(): void {
		this.#proc = spawn(path.join(ROOT, 'node_modules', '.bin', 'ts-node'), [
			'-T',
			path.join(__dirname, '../server/server.ts'),
			`--storage-path=${path.join(DB_FOLDER, 'matter')}`,
		]);

		this.#proc.on('error', (error) => {
			logTag(
				'matter-client',
				'red',
				`Failed to start process: ${error.message}`
			);
		});

		this.#proc.stdout.on('data', (data: Buffer | string) => {
			process.stdout.write(data.toString());
		});

		this.#proc.stderr.on('data', (data: Buffer | string) => {
			const dataStr = data.toString();
			for (const line of dataStr.split('\n')) {
				if (!line.trim()) {
					continue;
				}

				// Try to parse as JSON message first
				try {
					const message = JSON.parse(line.trim());
					if (MATTER_DEBUG) {
						logTag(
							'matter-client',
							'blue',
							`Received message: ${line}`
						);
					}
					this.#listeners.forEach((listener) => listener(message));
				} catch (error) {
					// If it's not JSON, it might be an error message from the process startup
					logTag(
						'matter-client',
						'red',
						`Process error: ${line.trim()}`
					);
				}
			}
		});

		process.on('exit', () => {
			this.#proc!.kill();
		});
		// Handle other termination signals
		['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((signal) => {
			process.on(signal, () => {
				this.#proc!.kill();
				// eslint-disable-next-line n/no-process-exit
				process.exit();
			});
		});

		let responded = false;
		void this.request({
			type: MatterServerInputMessageType.ListDevices,
			arguments: [],
		}).then((devices) => {
			responded = true;
			this.#updateDevices(devices);
		});
		setTimeout(() => {
			if (!responded) {
				logTag(
					'matter-client',
					'red',
					'No response from matter server'
				);
			}
		}, 5000);
		this.onMessage((message) => {
			if (
				message.category ===
				MatterServerOutputMessageType.StructureChanged
			) {
				void this.request({
					type: MatterServerInputMessageType.ListDevices,
					arguments: [],
				}).then(this.#updateDevices.bind(this));
			}
		});
	}

	public stop(): void {
		this.#proc?.kill();
	}

	public onMessage(
		listener: (message: MatterServerOutputMessage) => void
	): void {
		this.#listeners.add(listener);
	}

	public offMessage(
		listener: (message: MatterServerOutputMessage) => void
	): void {
		this.#listeners.delete(listener);
	}

	public async request<
		M extends MatterServerInputMessage,
		R extends MatterServerInputReturnValues[M['type']],
	>(message: M): Promise<MatterServerInputReturnValues[M['type']]> {
		return new Promise((resolve, reject) => {
			const identifier = this.#requestIdentifier++;
			const listener = (message: MatterServerOutputMessage) => {
				if (
					message.category ===
						MatterServerOutputMessageType.Response &&
					message.identifier === identifier
				) {
					this.offMessage(listener);
					resolve(message.response as R);
				}
			};
			this.onMessage(listener);
			if (!this.#proc) {
				console.error('Matter server not started');
				reject(new Error('Matter server not started'));
				return;
			}
			const messageString = JSON.stringify({
				identifier,
				...message,
			});
			if (MATTER_DEBUG) {
				logTag(
					'matter-client',
					'blue',
					`Sending message: ${messageString}`
				);
			}
			this.#proc.stdin.write(messageString + '\n');
		});
	}

	public pair(code: string): Promise<string[]> {
		return this.request({
			type: MatterServerInputMessageType.PairWithCode,
			arguments: [code],
		});
	}

	public [Symbol.dispose](): void {
		this.stop();
	}
}

if (require.main === module) {
	const matterClient = new MatterClient();
	matterClient.start();
	void matterClient.pair('10306615778').then((devices) => {
		console.log('pair', devices);
	});
	void matterClient.devices.get().then((devices) => {
		console.log('devices', devices);
	});
}
