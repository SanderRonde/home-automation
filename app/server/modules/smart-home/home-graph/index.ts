import smartHomeConfig from '../../../config/smart-home';

import { homegraph, homegraph_v1 } from '@googleapis/homegraph';
import { google } from 'googleapis';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
	Batcher,
	createHookables,
	fromEntries,
	SettablePromise,
} from '../../../lib/util';
import { Database } from '../../../lib/db';
import { currentUsers, initHomeGraphUsers } from './users';
import {
	SECRETS_FOLDER,
	SMART_HOME_BATCH_MAX_TIMEOUT,
	SMART_HOME_BATCH_MIN_TIMEOUT,
} from '../../../lib/constants';
import { warning } from '../../../lib/logger';
import {
	SmartHomeDeviceUpdate,
	SMART_HOME_DEVICE_TRAIT,
} from '../../../lib/smart-home/smart-home-types';
import { smartHomeLogger } from '../shared';
import { SmartHome } from '../';

export const homeGraph = new SettablePromise<homegraph_v1.Homegraph>();
export const db = new SettablePromise<Database>();

export async function requestSync(): Promise<void> {
	const hg = await homeGraph.value;
	await Promise.all(
		(
			await currentUsers.value
		).map(async (user) => {
			await hg.devices.requestSync({
				requestBody: {
					agentUserId: user,
					async: true,
				},
			});
		})
	);
}

async function createAuthClient() {
	const serviceAccountFile = path.join(
		SECRETS_FOLDER,
		'service-account.json'
	);
	const serviceAccountJSON = await (async () => {
		try {
			return await fs.readFile(serviceAccountFile, 'utf8');
		} catch (e) {
			throw new Error(
				`Missing service account file ("${serviceAccountFile}")`
			);
		}
	})();
	const auth = new google.auth.GoogleAuth({
		scopes: ['https://www.googleapis.com/auth/homegraph'],
		credentials: JSON.parse(serviceAccountJSON),
	});
	const authClient = await auth.getClient();
	google.options({ auth: authClient });

	const hg = homegraph({
		version: 'v1',
		auth: authClient,
	});

	homeGraph.set(hg);
}

async function attachUpdateListeners() {
	const batcher = new Batcher<SmartHomeDeviceUpdate<SMART_HOME_DEVICE_TRAIT>>(
		{
			minWaitTime: SMART_HOME_BATCH_MIN_TIMEOUT,
			maxWaitTime: SMART_HOME_BATCH_MAX_TIMEOUT,
			async onDispatch(data) {
				const requestBody: Omit<
					homegraph_v1.Schema$ReportStateAndNotificationRequest,
					'agentUserId'
				> = {
					payload: {
						devices: {
							states: fromEntries(
								data.map((dataPart) => [
									dataPart.id,
									dataPart.data,
								])
							),
						},
					},
				};

				const homeGraphInstance = await homeGraph.value;
				await Promise.all(
					(
						await currentUsers.value
					).map(async (user) => {
						const userRequestBody: homegraph_v1.Schema$ReportStateAndNotificationRequest =
							{
								...requestBody,
								agentUserId: user,
							};
						smartHomeLogger(
							'Sending homegraph update for user',
							user,
							Object.keys(
								userRequestBody.payload!.devices!.states!
							)
						);
						try {
							await homeGraphInstance.devices.reportStateAndNotification(
								{ requestBody: userRequestBody }
							);
						} catch (e) {
							warning(
								'Error response from home-graph',
								e,
								'for request',
								userRequestBody
							);
						}
					})
				);
			},
		}
	);

	const hookables = createHookables(
		await SmartHome.modules,
		'SMART_HOME',
		'HOME_GRAPH',
		{}
	);
	smartHomeConfig.forEach((Device) =>
		new Device().attachHomeGraphListeners(hookables, (update: unknown) => {
			batcher.call(
				update as SmartHomeDeviceUpdate<SMART_HOME_DEVICE_TRAIT>
			);
		})
	);
}

export async function initHomeGraph(_db: Database): Promise<void> {
	db.set(_db);
	await initHomeGraphUsers();
	await createAuthClient();
	await attachUpdateListeners();
}
