import { SwitchbotDeviceBase } from '@server/modules/switchbot/devices/devices';
import { SwitchbotCurtain } from '@server/modules/switchbot/devices/curtain';
import { SwitchbotApiDevice } from '@server/modules/switchbot/scanner';
import { AllModules } from '@server/modules';

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
