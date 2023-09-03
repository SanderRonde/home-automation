import { LinkEWeLinkDevice } from '../modules/ewelink/api';
import { AllModules } from '../modules';

export default function onEWeLinkDevices(
	linkDevice: LinkEWeLinkDevice,
	modules: AllModules
): Promise<void>;
