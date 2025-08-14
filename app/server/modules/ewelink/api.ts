/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
	EWeLinkConfig,
	EWeLinkWSConnection,
	WrappedEWeLinkAPI,
} from './client/clusters/shared';
import { EventEmitter } from '../../lib/event-emitter';
import { queueEwelinkTokenRefresh } from './routing';
import { EWELINK_DEBUG } from '../../lib/constants';
import { logTag } from '../../lib/logging/logger';
import { asyncSetInterval } from '../../lib/time';
import { EwelinkDevice } from './client/device';
import type { Database } from '../../lib/db';
import eWelink from 'ewelink-api-next';

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

	logTag('ewelink', 'blue', 'Creating WS connection');
	const ws = await wsClient.Connect.create(
		{
			appId: connection.appId!,
			at: connection.at,
			region: connection.region!,
			userApiKey,
		},
		() => {
			logTag('ewelink', 'blue', 'WS connection established');
		},
		() => {
			logTag('ewelink', 'yellow', 'WS connection closed');
			setTimeout(() => {
				void createWebsocketListener(
					connection,
					userApiKey,
					wsConnection
				);
			}, 1000 * 60);
		},
		(error) => {
			logTag('ewelink', 'red', 'WS connection errored', error);
		},
		(_ws, msg) => {
			if (msg.data.toString() === 'pong') {
				// Just a keep-alive
				return;
			}
			try {
				const data = JSON.parse(msg.data.toString());
				if (EWELINK_DEBUG) {
					logTag(
						'ewelink',
						'blue',
						'ws-message',
						JSON.stringify(data, null, '\t')
					);
				}
				wsConnection.emit(data);
			} catch (e) {
				logTag(
					'ewelink',
					'red',
					`Failed to parse ewelink message: ${msg.data.toString()}`
				);
			}
		}
	);

	return ws;
}

export async function initEWeLinkAPI(
	db: Database,
	// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
	api: InstanceType<typeof eWelink.WebAPI> | null,
	onDevices: (devices: EwelinkDevice[]) => void
): Promise<{
	refreshWebsocket?(): Promise<void>;
} | null> {
	if (!api) {
		return null;
	}

	const token = db.get<string>('accessToken');
	if (!token) {
		logTag(
			'ewelink',
			'yellow',
			'No token supplied, get one by going to /ewelink/oauth'
		);
		return null;
	}

	queueEwelinkTokenRefresh(api, db);

	api.at = token;
	return initEWeLinkDevices(api, onDevices);
}

async function initWebsocketListener(
	api: InstanceType<typeof eWelink.WebAPI>,
	wsConnectionWrapper: EWeLinkWSConnection
) {
	const userApiKey = await getUserApiKey(api);
	if (!userApiKey) {
		logTag(
			'ewelink',
			'red',
			'No API key found any user in home, skipping websocket connection'
		);
		return undefined;
	}

	let ws = await createWebsocketListener(
		api,
		userApiKey,
		wsConnectionWrapper
	);
	return async () => {
		ws?.close();
		ws = await createWebsocketListener(
			api,
			userApiKey,
			wsConnectionWrapper
		);
	};
}

async function updateDevices(
	api: InstanceType<typeof eWelink.WebAPI>,
	eventEmitters: Map<string, EventEmitter<EwelinkDeviceResponse>>,
	wrappedApi: WrappedEWeLinkAPI,
	wsConnectionWrapper: EWeLinkWSConnection
) {
	const {
		data: { thingList: response },
	} = (await api.device.getAllThings({})) as {
		data: {
			thingList: EwelinkDeviceResponse[] | undefined;
		};
	};

	const devices: EwelinkDevice[] = [];
	for (const deviceResponse of response ?? []) {
		if (eventEmitters.has(deviceResponse.itemData.deviceid)) {
			eventEmitters
				.get(deviceResponse.itemData.deviceid)!
				.emit(deviceResponse);
		} else {
			const eventEmitter = new EventEmitter<EwelinkDeviceResponse>();
			eventEmitters.set(deviceResponse.itemData.deviceid, eventEmitter);
			const config = new EWeLinkConfig(
				wrappedApi,
				deviceResponse,
				wsConnectionWrapper,
				eventEmitter
			);
			const ewelinkDevice = EwelinkDevice.from(config);
			if (ewelinkDevice) {
				devices.push(ewelinkDevice);
			}
		}
	}
	return devices;
}

export async function initEWeLinkDevices(
	api: InstanceType<typeof eWelink.WebAPI>,
	onDevices: (devices: EwelinkDevice[]) => void
): Promise<{
	refreshWebsocket?(): Promise<void>;
	devices: EwelinkDevice[];
}> {
	const wsConnectionWrapper = new EWeLinkWSConnection();
	const eventEmitters = new Map<
		string,
		EventEmitter<EwelinkDeviceResponse>
	>();
	const wrappedApi = new WrappedEWeLinkAPI(api);
	const initialDevices = await updateDevices(
		api,
		eventEmitters,
		wrappedApi,
		wsConnectionWrapper
	);
	onDevices(initialDevices);

	asyncSetInterval(
		async () => {
			onDevices(
				await updateDevices(
					api,
					eventEmitters,
					wrappedApi,
					wsConnectionWrapper
				)
			);
		},
		1000 * 60 * 2
	);

	logTag('ewelink', 'blue', 'API connection established');

	return {
		refreshWebsocket: await initWebsocketListener(api, wsConnectionWrapper),
		devices: initialDevices,
	};
}

async function getUserApiKey(connection: InstanceType<typeof eWelink.WebAPI>) {
	// Get family to extract API key
	const family = (await connection.home.getFamily({})) as {
		data: {
			familyList:
				| {
						apikey: string;
				  }[]
				| undefined;
		};
	};
	const apiKey = family.data.familyList?.map((user) => user.apikey)[0];
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
