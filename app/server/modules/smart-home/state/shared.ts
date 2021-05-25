import smartHomeConfig from '../../../config/smart-home';

import * as express from 'express';
import {
	SmartHomeDeviceSync,
	SMART_HOME_COMMAND,
} from '../../../lib/smart-home/smart-home-types';
import { addUser, removeUser } from '../home-graph/users';
import { createHookables } from '../../../lib/util';
import { SmartHome } from '../..';
import { attachMessage } from '../../../lib/logger';

export async function sharedSync(
	username: string
): Promise<SmartHomeDeviceSync[]> {
	await addUser(username);
	return smartHomeConfig.map((Device) => new Device().sync());
}

export async function sharedQuery(
	ids: string[],
	res: express.Response
): Promise<
	{
		id: string;
		value: Record<string, unknown>;
	}[]
> {
	const hookables = createHookables(
		await SmartHome.modules,
		'SMART_HOME',
		'QUERY',
		attachMessage(res, 'Smart Home Query')
	);
	const result = await Promise.all(
		ids.map(async (id) => {
			return {
				id,
				value: await smartHomeConfig
					.map((Device) => new Device())
					.find((entry) => entry.id === id)!
					.query(hookables),
			};
		})
	);
	return result;
}

export async function sharedExecute(
	deviceIDs: string[],
	command: SMART_HOME_COMMAND,
	params: Record<string, unknown>,
	res: express.Response
): Promise<
	{
		ids: string[];
		status: 'SUCCESS' | 'OFFLINE' | 'ERROR';
		errorCode?: string;
		state?: Record<string, unknown>;
	}[]
> {
	const hookables = createHookables(
		await SmartHome.modules,
		'SMART_HOME',
		'EXECUTE',
		attachMessage(res, 'Smart Home Execute')
	);
	return await Promise.all(
		deviceIDs.map(async (deviceID) => {
			const device = smartHomeConfig
				.map((Device) => new Device())
				.find((entry) => entry.id === deviceID);
			if (!device) {
				return {
					ids: [deviceID],
					status: 'ERROR' as const,
					errorCode: 'deviceNotFound',
				};
			}
			if (!(await device.isOnline(hookables))) {
				return {
					ids: [deviceID],
					status: 'OFFLINE' as const,
				};
			}

			const result = await device.execute(
				command,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				params as any,
				hookables
			);
			if (!result.success) {
				return {
					ids: [deviceID],
					status: 'ERROR' as const,
					errorCode: 'actionNotAvailable',
				};
			}

			return {
				ids: [deviceID],
				state: {
					...(await device.query(hookables)),
					...result.mergeWithQuery,
				},
				status: 'SUCCESS' as const,
			};
		})
	);
}

export async function sharedDisconnect(username: string): Promise<void> {
	await removeUser(username);
}
