import { SwitchbotCurtain } from '../modules/switchbot/devices/curtain';
import { SwitchbotApiDevice } from '../modules/switchbot/scanner';
import { AllModules } from '../modules';

export async function createSwitchbots(
	findDevice: (id: string) => Promise<SwitchbotApiDevice | null>,
	modules: AllModules
): Promise<void> {
	const foundDevice = await findDevice('someId');
	if (foundDevice) {
		await new SwitchbotCurtain(foundDevice, modules, 'some.keyval').init();
	}
}
