import { createExternalClass } from '@server/lib/external';
import { SwitchbotDeviceBase } from '@server/modules/switchbot/devices/devices';

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
