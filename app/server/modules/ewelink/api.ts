import {
	EWeLinkSharedConfig,
	EWeLinkWebSocketMessage,
	EWeLinkWSConnection,
} from './devices/shared';
import { EWELINK_DEBUG } from '../../lib/constants';
import onEWeLinkDevices from '../../config/ewelink';
import { getEnv } from '../../lib/io';
import eWelink from 'ewelink-api';
import { AllModules } from '..';

function createConnection(credentials: {
	email: string;
	password: string;
}): eWelink {
	return new eWelink({
		...credentials,
	});
}

export type LinkEWeLinkDevice = (
	id: string,
	onDevice: (config: EWeLinkSharedConfig) => Promise<void> | void
) => Promise<void>;

async function createWebsocketListener(
	connection: eWelink,
	wsConnection: EWeLinkWSConnection
) {
	let ignore = false;
	await connection.openWebSocket((data: EWeLinkWebSocketMessage) => {
		if (ignore) {
			return;
		}
		if (EWELINK_DEBUG) {
			console.log(data);
		}
		wsConnection.emit('data', data);
	});
	return {
		cancel() {
			ignore = true;
		},
	};
}

export async function initEWeLinkAPI(modules: AllModules): Promise<{
	refreshWebsocket?(): Promise<void>;
} | null> {
	const email = getEnv('SECRET_EWELINK_EMAIL', false);
	const password = getEnv('SECRET_EWELINK_PASSWORD', false);

	if (!email || !password) {
		return null;
	}

	const connection = createConnection({ email, password });
	const devices = await connection.getDevices();

	const wsConnection = new EWeLinkWSConnection();
	let wsConnectionListener = await createWebsocketListener(
		connection,
		wsConnection
	);

	await onEWeLinkDevices(async (id, onDevice) => {
		const device = devices.find((d) => d.deviceid === id);
		if (device) {
			await onDevice({
				device,
				connection,
				wsConnection,
				modules,
			});
		}
	});

	return {
		async refreshWebsocket() {
			wsConnectionListener.cancel();
			wsConnectionListener = await createWebsocketListener(
				connection,
				wsConnection
			);
		},
	};
}
