import smartHomeConfig from '../../../config/smart-home';

import {
	SmartHomeDeviceSync,
	SMART_HOME_COMMAND,
} from '../../../lib/smart-home/smart-home-types';
import { addUser, removeUser } from '../home-graph/users';
import { createHookables } from '../../../lib/util';
import { attachMessage } from '../../../lib/logger';
import { time } from '../../../lib/timer';
import * as express from 'express';
import { SmartHome } from '../..';

export async function sharedSync(
	username: string,
	response: express.Response
): Promise<SmartHomeDeviceSync[]> {
	time(response, 'add-user-start');
	await addUser(username);
	time(response, 'add-user-end');
	const responses: SmartHomeDeviceSync[] = [];
	for (const device of smartHomeConfig) {
		responses.push(new device().sync());
		time(response, `get-device-${new device().id}`);
	}
	return responses;
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
	time(res, 'shared-query-start');
	const awaitModules = await SmartHome.modules;
	time(res, 'await-modules');
	const hookables = createHookables(
		awaitModules,
		'SMART_HOME',
		'QUERY',
		attachMessage(res, 'Smart Home Query')
	);
	time(res, 'create-hookables');
	const result = await Promise.all(
		ids.map(async (id) => {
			const result = {
				id,
				value: await smartHomeConfig
					.map((Device) => new Device())
					.find((entry) => entry.id === id)!
					.query(hookables, res),
			};
			return result;
		})
	);
	time(res, 'do-queries');
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
	time(res, 'shared-execute-start');
	const awaitedModules = await SmartHome.modules;
	time(res, 'module-await');
	const hookables = createHookables(
		awaitedModules,
		'SMART_HOME',
		'EXECUTE',
		attachMessage(res, 'Smart Home Execute')
	);
	time(res, 'create-hookables');
	const result = await Promise.all(
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

			const preOnlineCheck = Date.now();
			if (!(await device.isOnline(hookables))) {
				return {
					ids: [deviceID],
					status: 'OFFLINE' as const,
				};
			}
			const postOnlineCheck = Date.now();
			time(
				res,
				`${device.id} online check - ${
					postOnlineCheck - preOnlineCheck
				}ms`
			);

			const preExecute = Date.now();
			const result = await device.execute(
				command,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				params as any,
				hookables
			);
			const postExecute = Date.now();
			time(res, `${device.id} execute - ${postExecute - preExecute}ms`);
			if (!result.success) {
				return {
					ids: [deviceID],
					status: 'ERROR' as const,
					errorCode: 'actionNotAvailable',
				};
			}

			const preQuery = Date.now();
			const query = await device.query(hookables, res);
			const postQuery = Date.now();
			time(res, `${device.id} query - ${postQuery - preQuery}ms`);
			return {
				ids: [deviceID],
				state: {
					...query,
					...result.mergeWithQuery,
				},
				status: 'SUCCESS' as const,
			};
		})
	);
	time(res, 'shared-execute-done');
	return result;
}

export async function sharedDisconnect(username: string): Promise<void> {
	await removeUser(username);
}
