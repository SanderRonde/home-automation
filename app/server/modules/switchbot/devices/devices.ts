import { SwitchbotAdvertisement } from 'node-switchbot';
import { debounce, wait } from '@server/lib/util';
import { SwitchbotApiDevice } from '@server/modules/switchbot/scanner';
import { logTag } from '@server/lib/logger';
import { SwitchbotCurtain } from '@server/modules/switchbot/devices/curtain';
import { AllModules } from '@server/modules';

export type SwitchbotDevice = SwitchbotCurtain;

export abstract class SwitchbotDeviceBase {
	public get deviceId(): string {
		return this._apiDevice.device.id;
	}

	public constructor(
		private readonly _apiDevice: SwitchbotApiDevice,
		protected readonly _modules: AllModules,
		protected readonly _keyval: string
	) {}

	protected abstract onChange(value: string): Promise<void>;
	protected abstract onMessage(
		message: SwitchbotAdvertisement
	): Promise<void>;

	public async init(): Promise<this> {
		const keyval = new this._modules.keyval.External(
			{},
			'SWITCHBOT.DEVICE.INIT'
		);

		await keyval.onChange(this._keyval, async (value) => {
			if (await this.onCommand()) {
				await this.onChange(value);
			}
			await this._apiDevice.device.disconnect();
		});

		const listener = debounce((message: SwitchbotAdvertisement) => {
			void this.onMessage(message);
		}, 250);
		this._apiDevice.onMessage.listen(listener);
		return this;
	}

	public async onCommand(): Promise<boolean> {
		for (let i = 0; i < 10; i++) {
			try {
				await this._apiDevice.device.connect();
				if (this._apiDevice.device.connectionState === 'connected') {
					return true;
				}
			} catch (e) {
				// Ignore
			} finally {
				await wait(1000);
			}
		}

		const success = this._apiDevice.device.connectionState === 'connected';
		if (!success) {
			logTag('switchbot', 'red', 'Failed to connect to device');
		}
		return success;
	}
}
