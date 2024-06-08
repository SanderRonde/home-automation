import type { SwitchbotDeviceBase } from './devices/devices';
import { createExternalClass } from '../../lib/external';

export class ExternalHandler extends createExternalClass(false) {
	private static _bots: SwitchbotDeviceBase[] = [];

	public static init(bots: SwitchbotDeviceBase[]): Promise<void> {
		this._bots = bots;
		return Promise.resolve();
	}

	public async getBot(deviceId: string): Promise<SwitchbotDeviceBase | null> {
		return this.runRequest(() => {
			return (
				ExternalHandler._bots.find(
					(bot) => bot.deviceId === deviceId
				) ?? null
			);
		});
	}
}
