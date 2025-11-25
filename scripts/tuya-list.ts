// Run with Bun or TS-node
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// eslint-disable-next-line @typescript-eslint/no-require-imports
import {
	IGNORED_TUYA_DEVICES,
	TUYA_DEVICES,
} from '../app/server/modules/tuya/device/devices/thermostat';
import { TuyaContext } from '../app/server/modules/tuya/client/context';
import { TuyaAPI } from '../app/server/modules/tuya/client/api';

void (async () => {
	// Get credentials from argv: node tuya-list.js <apiKey> <apiSecret> <apiRegion> <virtualDeviceId>
	const [, , apiKey, apiSecret, apiRegion, virtualDeviceId] = process.argv;

	if (!apiKey || !apiSecret || !apiRegion || !virtualDeviceId) {
		console.error(
			'Usage: node tuya-list.js <apiKey> <apiSecret> <apiRegion> <virtualDeviceId>'
		);
		// eslint-disable-next-line n/no-process-exit
		process.exit(1);
	}

	const credentials = {
		apiKey,
		apiSecret,
		apiRegion,
		virtualDeviceId,
	};

	// Get seed device
	const api = new TuyaAPI(
		new TuyaContext({
			baseUrl: `https://openapi.tuya${credentials.apiRegion}.com`,
			accessKey: credentials.apiKey,
			secretKey: credentials.apiSecret,
		})
	);
	const userId = await api.getUserId(credentials.virtualDeviceId).catch((error) => {
		console.error(error);
		throw new Error('Failed to get user ID');
	});

	// Get user devices
	const userDevices = await api.getUserDevices(userId);

	process.stdout.write(
		JSON.stringify(
			userDevices.map((device) => ({
				id: device.id,
				key: device.local_key,
				name: device.name,
				productName: device.product_name,
			}))
		) + '\n'
	);

	if (process.argv.includes('--create-devices')) {
		for (const device of userDevices) {
			const TuyaDevice = TUYA_DEVICES[device.product_name];
			if (!TuyaDevice) {
				if (!IGNORED_TUYA_DEVICES.includes(device.product_name)) {
					console.warn(`No Tuya device found for product ID ${device.product_name}`);
				}
				continue;
			}
			const tuyaDevice = new TuyaDevice(device.name, api, device.id);
			// eslint-disable-next-line no-console
			console.log('created device', tuyaDevice.getUniqueId());
		}
	}
})();
