import { SwitchbotDeviceBase } from '../modules/switchbot/devices/devices';
import { SwitchbotApiDevice } from '../modules/switchbot/scanner';
import { AllModules } from '../modules';

export function createSwitchbots(
	findDevice: (id: string) => Promise<SwitchbotApiDevice | null>,
	modules: AllModules
): Promise<SwitchbotDeviceBase[]>;
