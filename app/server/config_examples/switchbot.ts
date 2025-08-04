import type { SwitchbotDeviceBase } from '../modules/switchbot/devices/devices';
import { SwitchbotCurtain } from '../modules/switchbot/devices/curtain';
import type { SwitchBotAPI } from '../modules/switchbot/scanner';
import type { AllModules } from '../modules';

export function hasSwitchbots(): boolean {
	return true;
}

export function createSwitchbots(
	modules: AllModules,
	api: SwitchBotAPI
): SwitchbotDeviceBase[] {
	return [new SwitchbotCurtain('MAC', modules, api, 'some.keyval').init()];
}
