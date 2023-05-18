import {
	SwitchbotAdvertisement,
	SwitchbotWoDeviceCurtain,
} from 'node-switchbot';
import { EventEmitter } from '../../../lib/event-emitter';
import { SwitchbotApiDevice } from '../scanner';
import { SwitchbotDeviceBase } from './devices';
import { AllModules } from '../..';

export class SwitchbotCurtain extends SwitchbotDeviceBase {
	private _keyvalHandler = new this._modules.keyval.External(
		{},
		'SWITCHBOT.DEVICE.CURTAIN'
	);
	public progress: number = 0;
	public inMotion: boolean = false;

	public isOpen: EventEmitter<boolean> = new EventEmitter();

	public constructor(
		private readonly _curtainDevice: SwitchbotApiDevice<SwitchbotWoDeviceCurtain>,
		_modules: AllModules,
		_keyval: string
	) {
		super(_curtainDevice, _modules, _keyval);
	}

	protected override async onChange(value: string): Promise<void> {
		if (value === '1') {
			await this._curtainDevice.device.open();
		} else {
			await this._curtainDevice.device.close();
		}
	}

	protected override async onMessage(
		message: SwitchbotAdvertisement
	): Promise<void> {
		this.progress = message.serviceData.position;
		this.inMotion = message.serviceData.inMotion;

		if (!this.inMotion && this._keyval) {
			await this._keyvalHandler.set(
				this._keyval,
				this.progress > 50 ? '1' : '0',
				false
			);
			this.isOpen.emit(this.progress > 50);
		}
	}
}
