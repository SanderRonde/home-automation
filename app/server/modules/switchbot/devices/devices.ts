import type {
	SwitchBotAPI,
	SwitchBotCommand,
	SwitchbotAdvertisement,
} from '../scanner';
import type { EventEmitter } from '../../../lib/event-emitter';
import { LogObj } from '../../../lib/logging/lob-obj';
import type { SwitchbotCurtain } from './curtain';
import type { AllModules } from '../..';

export type SwitchbotDevice = SwitchbotCurtain;

export abstract class SwitchbotDeviceBase {
	protected get api(): {
		onMessage: EventEmitter<SwitchbotAdvertisement>['listen'];
		sendCommand: (command: Omit<SwitchBotCommand, 'mac'>) => void;
	} {
		return {
			onMessage: (handler: (value: SwitchbotAdvertisement) => void) => {
				const emitter = this._api.onMessage(this.mac);
				emitter.listen(handler);
			},
			sendCommand: (command: Omit<SwitchBotCommand, 'mac'>) =>
				this._api.sendCommand({ mac: this.mac, ...command }),
		};
	}

	public constructor(
		public readonly mac: string,
		protected readonly _modules: AllModules,
		protected readonly _api: SwitchBotAPI,
		protected readonly _keyval: string
	) {}

	protected abstract onChange(value: string): void;
	protected abstract onMessage(
		message: SwitchbotAdvertisement
	): Promise<void>;

	public async init(): Promise<this> {
		const keyval = new this._modules.keyval.External(
			LogObj.fromEvent('SWITCHBOT.DEVICE.INIT')
		);

		await keyval.onChange(this._keyval, (value) => {
			this.onChange(value);
		});

		this.api.onMessage((message: SwitchbotAdvertisement) => {
			void this.onMessage(message);
		});
		return this;
	}
}
