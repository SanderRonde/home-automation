import type {
	SwitchBotDevice,
	SwitchbotAdvertisement,
} from '../../../../temp/node-switchbot';
import type { SwitchbotDeviceBase } from './devices/devices';
import { SwitchBot } from '../../../../temp/node-switchbot';
import { createSwitchbots } from '../../config/switchbot';
import { registerExitHandler } from '../../lib/shutdown';
import { EventEmitter } from '../../lib/event-emitter';
import { logTag } from '../../lib/logging/logger';
import type { AllModules } from '..';

export async function scanSwitchbots(
	modules: AllModules
): Promise<SwitchbotDeviceBase[]> {
	const switchbot = new SwitchBot();
	const botMap: Record<string, SwitchbotApiDevice> = {};
	const bots = await createSwitchbots(async (id: string) => {
		const [device] = await switchbot.discover({
			duration: 1000 * 60,
			id,
			quick: true,
		});
		if (!device) {
			logTag('switchbot', 'cyan', 'Failed to find device ' + id);
			return null;
		}
		const apiDevice = new SwitchbotApiDevice(device);
		botMap[id] = apiDevice;
		logTag('switchbot', 'cyan', 'Found device ' + id);
		return apiDevice;
	}, modules);
	void switchbot.startScan().then(() => {
		switchbot.onadvertisement = (advertisement) => {
			botMap[advertisement.id]?.onMessage.emit(advertisement);
		};
	});
	registerExitHandler(() => switchbot.stopScan());

	return bots;
}

export class SwitchbotApiDevice<D extends SwitchBotDevice = SwitchBotDevice> {
	public onMessage: EventEmitter<SwitchbotAdvertisement> = new EventEmitter();

	public constructor(public readonly device: D) {}
}
