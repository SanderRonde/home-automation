import { ExternalHandler } from '../../keyval/external';
import { EWeLinkSharedConfig } from './shared';

export class EwelinkPower {
	private _keyvalExternal!: ExternalHandler;
	private _options: {
		enableSync: boolean;
	};

	constructor(
		private _eWeLinkConfig: EWeLinkSharedConfig,
		private _keyVal: string,
		options?: {
			enableSync?: boolean;
		}
	) {
		this._options = {
			enableSync: options?.enableSync ?? true,
		};
	}

	async init(): Promise<void> {
		this._keyvalExternal = new this._eWeLinkConfig.modules.keyval.External(
			{},
			'EWELINK.POWER.INIT'
		);
		if (this._options.enableSync) {
			this._startTimer();
		}
		await this._keyvalExternal.onChange(
			this._keyVal,
			async (value: string) => {
				if (value === '1') {
					await this.turnOn();
				} else {
					await this.turnOff();
				}
			}
		);
	}

	async setPower(isOn: boolean): Promise<void> {
		await this._eWeLinkConfig.connection.setDevicePowerState(
			this._eWeLinkConfig.device.deviceid,
			isOn ? 'on' : 'off'
		);
	}

	turnOn(): Promise<void> {
		return this.setPower(true);
	}

	turnOff(): Promise<void> {
		return this.setPower(false);
	}

	private async _syncStatus() {
		const remoteState =
			await this._eWeLinkConfig.connection.getDevicePowerState(
				this._eWeLinkConfig.device.deviceid
			);
		const localState = await this._keyvalExternal.get(this._keyVal);

		if ((remoteState === 'on') !== (localState === '1')) {
			await this._keyvalExternal.set(
				this._keyVal,
				remoteState === 'on' ? '1' : '0',
				false
			);
		}
	}

	private _startTimer() {
		setInterval(() => this._syncStatus(), 1000 * 60);
	}
}
