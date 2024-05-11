import smartHomeConfig from '@server/config/smart-home';

import {
	SECRETS_FOLDER,
	SMART_HOME_BATCH_MAX_TIMEOUT,
	SMART_HOME_BATCH_MIN_TIMEOUT,
} from '@server/lib/constants';
import {
	SmartHomeDeviceUpdate,
	SMART_HOME_DEVICE_TRAIT,
} from '@server/lib/smart-home/smart-home-types';
import { Batcher, createHookables, SettablePromise } from '@server/lib/util';
import { homegraph, homegraph_v1 } from '@googleapis/homegraph';
import { currentUsers, initHomeGraphUsers } from '@server/modules/smart-home/home-graph/users';
import { dispatchSamsungUsers } from '@server/modules/smart-home/state/samsung';
import { dispatchGoogleUsers } from '@server/modules/smart-home/state/google';
import { Database } from '@server/lib/db';
import { google } from 'googleapis';
import { SmartHome } from '@server/modules/smart-home';
import * as fs from 'fs-extra';
import * as path from 'path';

export const homeGraph = new SettablePromise<homegraph_v1.Homegraph>();
export const db = new SettablePromise<Database>();
export const GOOGLE_KEY = 'google';
export const SAMSUNG_KEY = 'samsung';

export async function requestSync(): Promise<void> {
	const hg = await homeGraph.value;
	const googleUsers = (await currentUsers.value)[GOOGLE_KEY] ?? {};
	await Promise.all(
		Object.keys(googleUsers).map(async (user) => {
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
				await Promise.all([
					dispatchGoogleUsers(data),
					dispatchSamsungUsers(data),
				]);
			},
		}
	);

	const hookables = createHookables(
		await SmartHome.modules,
		'SMART_HOME',
		'HOME_GRAPH',
		{}
	);
	await Promise.all(
		smartHomeConfig.map((Device) =>
			new Device().attachHomeGraphListeners(
				hookables,
				(update: unknown) => {
					batcher.call(
						update as SmartHomeDeviceUpdate<SMART_HOME_DEVICE_TRAIT>
					);
				}
			)
		)
	);
}

export async function initHomeGraph(_db: Database): Promise<void> {
	db.set(_db);
	await initHomeGraphUsers();
	await createAuthClient();
	await attachUpdateListeners();
}
