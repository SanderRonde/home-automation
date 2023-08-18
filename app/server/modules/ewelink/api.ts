import { EWeLinkSharedConfig, EWeLinkWSConnection } from './devices/shared';
import eWelink from '../../../../temp/ewelink-api-next';
import { queueEwelinkTokenRefresh } from './routing';
import onEWeLinkDevices from '../../config/ewelink';
import { Database } from '../../lib/db';
import { log } from '../../lib/logger';
import { AllModules } from '..';

export type LinkEWeLinkDevice = (
	id: string,
	onDevice: (config: EWeLinkSharedConfig) => Promise<void> | void
) => Promise<void>;

// Currently broken!
// async function createWebsocketListener(
// 	connection: InstanceType<typeof eWelink.WebAPI>,
// 	wsConnection: EWeLinkWSConnection
// ) {
// 	const wsClient = new eWelink.Ws({
// 		appId: connection.appId!,
// 		appSecret: connection.appSecret!,
// 		region: connection.region!,
// 	});
// 	wsClient.at = connection.at;

// 	const ws = await wsClient.Connect.create({
// 		appId: wsClient.appId!,
// 		at: wsClient.at!,
// 		region: wsClient.region!,
// 		userApiKey: wsClient.userApiKey!,
// 	});
// 	console.log('instance', ws);

// 	let ignore = false;
// 	ws.on('message', (data: EWeLinkWebSocketMessage) => {
// 		if (ignore) {
// 			return;
// 		}
// 		if (EWELINK_DEBUG) {
// 			console.log(data);
// 		}
// 		wsConnection.emit('data', data);
// 	});
// 	return {
// 		cancel() {
// 			ignore = true;
// 		},
// 	};
// }

export async function initEWeLinkAPI(
	db: Database,
	modules: AllModules,
	api: InstanceType<typeof eWelink.WebAPI> | null
): Promise<{
	refreshWebsocket?(): Promise<void>;
} | null> {
	const token = db.get<string>('accessToken');
	console.log(token);
	if (!api) {
		return null;
	}

	if (!token) {
		log('EWeLink', 'No token supplied, get one by going to /ewelink/oauth');
		return null;
	}

	console.log('set it');
	api.at = token;
	queueEwelinkTokenRefresh(api, db);

	const {
		data: { thingList: devices },
	} = (await api.device.getAllThings({})) as {
		data: {
			thingList: EwelinkDeviceResponse[];
		};
	};

	const wsConnection = new EWeLinkWSConnection();
	// let wsConnectionListener = await createWebsocketListener(api, wsConnection);

	await onEWeLinkDevices(async (id, onDevice) => {
		const device = devices.find((d) => d.itemData.deviceid === id);
		if (device) {
			await onDevice({
				device,
				connection: api,
				wsConnection,
				modules,
			});
		}
	});

	return {
		async refreshWebsocket() {
			// wsConnectionListener.cancel();
			// wsConnectionListener = await createWebsocketListener(
			// 	api,
			// 	wsConnection
			// );
		},
	};
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
