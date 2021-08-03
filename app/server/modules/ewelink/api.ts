import eWelink from 'ewelink-api';
import { getEnv } from '../../lib/io';
import {
	EWeLinkSharedConfig,
	EWeLinkWebSocketMessage,
	EWeLinkWSConnection,
} from './devices/shared';
import onEWeLinkDevices from '../../config/ewelink';
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

export async function initEWeLinkAPI(modules: AllModules): Promise<void> {
	const email = getEnv('SECRET_EWELINK_EMAIL', false);
	const password = getEnv('SECRET_EWELINK_PASSWORD', false);

	if (!email || !password) {
		return;
	}

	const connection = createConnection({ email, password });
	const devices = await connection.getDevices();

	const wsConnection = new EWeLinkWSConnection();
	await connection.openWebSocket((data: EWeLinkWebSocketMessage) => {
		wsConnection.emit('data', data);
	});

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
}
