import { EventEmitter } from '../../../lib/event-emitter';
import type { SwitchbotAdvertisement } from '../scanner';
import { LogObj } from '../../../lib/logging/lob-obj';
import { SwitchbotDeviceBase } from './devices';

export class SwitchbotCurtain extends SwitchbotDeviceBase {
	public progress: number = 0;

	public isOpen: EventEmitter<boolean> = new EventEmitter();

	public get openPercent(): number {
		return SwitchbotCurtain._getOpenPercent(this.progress);
	}

	private static _getOpenPercent(progress: number): number {
		return 100 - progress;
	}

	protected override onChange(value: string): void {
		if (value === '1') {
			this.api.sendCommand({ action: 'open' });
		} else {
			this.api.sendCommand({ action: 'close' });
		}
	}

	protected override async onMessage(
		message: SwitchbotAdvertisement
	): Promise<void> {
		this.progress = message.position;

		if (this._keyval) {
			await this._modules.keyval.set(
				LogObj.fromEvent('SWITCHBOT.DEVICE.CURTAIN'),
				this._keyval,
				this.progress > 50 ? '1' : '0',
				false
			);
			this.isOpen.emit(this.progress > 50);
		}
	}
}
