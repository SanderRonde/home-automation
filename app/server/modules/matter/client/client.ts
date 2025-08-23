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
import type { ChildProcessWithoutNullStreams } from 'child_process';
import { AsyncEventEmitter } from '../../../lib/event-emitter';
import { logTag } from '../../../lib/logging/logger';
import type { EndpointNumber } from '@matter/types';
import { DB_FOLDER } from '../../../lib/constants';
import { MatterDevice } from './device';
import { spawn } from 'child_process';
import * as path from 'path';

export class MatterClient implements AsyncDisposable {
	#requestIdentifier = 0;
	#proc: ChildProcessWithoutNullStreams | null = null;
	#listeners: Set<(message: MatterServerOutputMessage) => void> = new Set();

	public devices = new AsyncEventEmitter<
		Record<EndpointNumber, MatterDevice>
	>();

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
		this.devices.emit(devices);
	}

	public start(): void {
		this.#proc = spawn('ts-node', [
			'-T',
			path.join(__dirname, '../server/server.ts'),
			`--storage-path=${path.join(DB_FOLDER, 'matter')}`,
		]);
		this.#proc.stdout.on('data', (data: Buffer | string) => {
			process.stdout.write(data.toString());
		});
		this.#proc.stderr.on('data', (data: Buffer | string) => {
			for (const line of data.toString().split('\n')) {
				if (!line.trim()) {
					continue;
				}
				logTag('matter-client', 'blue', `Received message: ${line}`);
				try {
					const message = JSON.parse(line.trim());
					this.#listeners.forEach((listener) => listener(message));
				} catch (error) {
					console.error(`server:error:${line.trim()}`);
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
				// eslint-disable-next-line no-process-exit
				process.exit();
			});
		});

		void this.request({
			type: MatterServerInputMessageType.ListDevices,
			arguments: [],
		}).then(this.#updateDevices.bind(this));
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
	>(message: M): Promise<R> {
		return new Promise((resolve) => {
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
				return;
			}
			const messageString = JSON.stringify({
				identifier,
				...message,
			});
			logTag(
				'matter-client',
				'blue',
				`Sending message: ${messageString}`
			);
			this.#proc.stdin.write(messageString + '\n');
		});
	}

	public pair(code: string): Promise<string[]> {
		return this.request({
			type: MatterServerInputMessageType.PairWithCode,
			arguments: [code],
		});
	}

	public async [Symbol.asyncDispose](): Promise<void> {
		this.stop();
		for (const device of Object.values(await this.devices.value)) {
			device[Symbol.dispose]();
		}
	}
}

if (require.main === module) {
	const matterClient = new MatterClient();
	matterClient.start();
	void matterClient.devices.value.then((devices) => {
		console.log(devices);
	});
}
