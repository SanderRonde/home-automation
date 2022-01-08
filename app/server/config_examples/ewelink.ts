import { EwelinkMovement } from '../modules/ewelink/devices/movement-detector';
import { EwelinkPower } from '../modules/ewelink/devices/power';
import { LinkEWeLinkDevice } from '../modules/ewelink/api';

export default async function onEWeLinkDevices(
	linkDevice: LinkEWeLinkDevice
): Promise<void> {
	// Do something with the devices. You can get
	// the IDs from your app
	await linkDevice('someMadeUpId', (config) => {
		return new EwelinkPower(config, 'ceiling.light').init();
	});

	await linkDevice('anotherID', (config) => {
		return new EwelinkMovement(config, 'door').init();
	});
}
