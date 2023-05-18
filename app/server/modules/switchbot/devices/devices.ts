import { SwitchbotAdvertisement } from 'node-switchbot';
import { SwitchbotApiDevice } from '../scanner';
import { logTag } from '../../../lib/logger';
import { SwitchbotCurtain } from './curtain';
import { wait } from '../../../lib/util';
import { AllModules } from '../..';

export type SwitchbotDevice = SwitchbotCurtain;

export abstract class SwitchbotDeviceBase {
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

		this._apiDevice.onMessage.listen((message) => {
			void this.onMessage(message);
		});
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
