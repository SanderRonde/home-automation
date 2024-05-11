import { EwelinkMovement } from '@server/modules/ewelink/devices/sensors/movement-sensor';
import { EwelinkSimplePower } from '@server/modules/ewelink/devices/power/simple-power';
import { LinkEWeLinkDevice } from '@server/modules/ewelink/api';

export default async function onEWeLinkDevices(
	linkDevice: LinkEWeLinkDevice
): Promise<void> {
	// Do something with the devices. You can get
	// the IDs from your app
	await linkDevice('someMadeUpId', (config) => {
		return new EwelinkSimplePower(config, 'ceiling.light').init();
	});

	await linkDevice('anotherID', (config) => {
		return new EwelinkMovement(config, 'door').init();
	});
}
