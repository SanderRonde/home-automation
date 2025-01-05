import type { SwitchbotDeviceBase } from '../modules/switchbot/devices/devices';
import { SwitchbotCurtain } from '../modules/switchbot/devices/curtain';
import type { SwitchBotAPI } from '../modules/switchbot/scanner';
import type { AllModules } from '../modules';

export async function createSwitchbots(
	modules: AllModules,
	api: SwitchBotAPI
): Promise<SwitchbotDeviceBase[]> {
	return [
		await new SwitchbotCurtain('MAC', modules, api, 'some.keyval').init(),
	];
}
