import { SwitchbotDeviceBase } from '../modules/switchbot/devices/devices';
import { SwitchbotCurtain } from '../modules/switchbot/devices/curtain';
import { SwitchbotApiDevice } from '../modules/switchbot/scanner';
import { AllModules } from '../modules';

export async function createSwitchbots(
	findDevice: (id: string) => Promise<SwitchbotApiDevice | null>,
	modules: AllModules
): Promise<SwitchbotDeviceBase[]> {
	const foundDevice = await findDevice('someId');
	if (foundDevice) {
		return [
			await new SwitchbotCurtain(
				foundDevice,
				modules,
				'some.keyval'
			).init(),
		];
	}
	return [];
}
