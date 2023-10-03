/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
	EWeLinkSharedConfig,
	EWeLinkWSConnection,
	WrappedEWeLinkAPI,
} from './devices/shared';
import eWelink from '../../../../temp/ewelink-api-next';
import { queueEwelinkTokenRefresh } from './routing';
import onEWeLinkDevices from '../../config/ewelink';
import { EWELINK_DEBUG } from '../../lib/constants';
import { logTag } from '../../lib/logger';
import { Database } from '../../lib/db';
import { AllModules } from '..';

export type LinkEWeLinkDevice = (
	id: string,
	onDevice: (config: EWeLinkSharedConfig) => Promise<void> | void
) => Promise<void>;

async function createWebsocketListener(
	connection: InstanceType<typeof eWelink.WebAPI>,
	userApiKey: string,
	wsConnection: EWeLinkWSConnection
) {
	const wsClient = new eWelink.Ws({
		appId: connection.appId!,
		appSecret: connection.appSecret!,
		region: connection.region!,
	});

	const ws = await wsClient.Connect.create(
		{
			appId: connection.appId!,
			at: connection.at!,
			region: connection.region!,
			userApiKey,
		},
		() => {
			logTag('ewelink', 'blue', 'WS connection established');
		},
		() => {
			logTag('ewelink', 'yellow', 'WS connection closed');
		},
		() => {
			logTag('ewelink', 'red', 'WS connection errored');
		},
		(_ws, msg) => {
			const data = JSON.parse(msg.data.toString());
			if (EWELINK_DEBUG) {
				console.log(data);
			}
			wsConnection.emit('data', data);
		}
	);

	return ws;
}

export async function initEWeLinkAPI(
	db: Database,
	modules: AllModules,
	api: InstanceType<typeof eWelink.WebAPI> | null
): Promise<{
	refreshWebsocket?(): Promise<void>;
} | null> {
	const token = db.get<string>('accessToken');
	if (!api) {
		return null;
	}

	if (!token) {
		logTag(
			'ewelink',
			'yellow',
			'No token supplied, get one by going to /ewelink/oauth'
		);
		return null;
	}

	api.at = token;
	queueEwelinkTokenRefresh(api, db);

	const wsConnectionWrapper = new EWeLinkWSConnection();
	const {
		data: { thingList: devices },
	} = (await api.device.getAllThings({})) as {
		data: {
			thingList: EwelinkDeviceResponse[];
		};
	};
	await onEWeLinkDevices(async (id, onDevice) => {
		const device = devices.find((d) => d.itemData.deviceid === id);
		if (device) {
			await onDevice({
				device,
				connection: new WrappedEWeLinkAPI(api),
				wsConnection: wsConnectionWrapper,
				modules,
			});
		}
	}, modules);
	logTag('ewelink', 'blue', 'API connection established');

	let wsRefresh = undefined;
	const userApiKey = await getUserApiKey(api);
	if (!userApiKey) {
		logTag(
			'ewelink',
			'red',
			'No API key found any user in home, skipping websocket connection'
		);
	} else {
		let ws = await createWebsocketListener(
			api,
			userApiKey,
			wsConnectionWrapper
		);
		wsRefresh = async () => {
			if (ws) {
				ws.close();
			}
			ws = await createWebsocketListener(
				api,
				userApiKey,
				wsConnectionWrapper
			);
		};
	}

	return {
		refreshWebsocket: wsRefresh,
	};
}

async function getUserApiKey(connection: InstanceType<typeof eWelink.WebAPI>) {
	// Get family to extract API key
	const family = (await connection.home.getFamily({})) as {
		data: {
			familyList: {
				apikey: string;
			}[];
		};
	};
	const apiKey = family.data.familyList.map((user) => user.apikey)[0];
	if (!apiKey) {
		logTag(
			'ewelink',
			'red',
			'No API key found any user in home for websocket connection'
		);
		return null;
	}
	return apiKey;
}

export interface EwelinkDeviceResponse {
	itemType: number;
	index: number;
	itemData: {
		name: string;
		deviceid: string;
		apikey: string;
		brandName: string;
		productModel: string;
		devicekey: string;
		online: boolean;
		params: Record<string, unknown>;
	};
}
