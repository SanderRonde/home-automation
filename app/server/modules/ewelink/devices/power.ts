import chalk from 'chalk';
import { logFixture, ResDummy } from '../../../lib/logger';
import {
	EWeLinkInittable,
	EWeLinkSharedConfig,
	EWeLinkWebSocketMessage,
} from './shared';

export class EwelinkPower extends EWeLinkInittable {
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
		super();
		this._options = {
			enableSync: options?.enableSync ?? true,
		};
	}

	private _getKeyval(source: string) {
		const resDummy = new ResDummy();
		return {
			resDummy,
			keyval: new this._eWeLinkConfig.modules.keyval.External(
				resDummy,
				source
			),
		};
	}

	async init(): Promise<void> {
		if (this._options.enableSync) {
			this._startTimer();
		}
		const { keyval } = this._getKeyval('EWELINK.POWER.INIT');
		await keyval.onChange(this._keyVal, async (value: string) => {
			if (value === '1') {
				await this.turnOn();
			} else {
				await this.turnOff();
			}
		});
		this._eWeLinkConfig.wsConnection.on(
			'data',
			async (data: EWeLinkWebSocketMessage<{ switch: 'on' | 'off' }>) => {
				if (
					typeof data === 'string' ||
					!('action' in data) ||
					data.action !== 'update' ||
					data.deviceid !== this._eWeLinkConfig.device.deviceid
				) {
					return;
				}

				await this._setFromRemoteStatus(
					data.params.switch,
					'websocket'
				);
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

	private async _setFromRemoteStatus(
		remoteState: 'on' | 'off',
		source: string
	) {
		const logName = `EWELINK.POWER.${source.toUpperCase()}`;
		const { keyval, resDummy } = this._getKeyval(logName);
		const localState = await keyval.get(this._keyVal);

		if ((remoteState === 'on') !== (localState === '1')) {
			await keyval.set(
				this._keyVal,
				remoteState === 'on' ? '1' : '0',
				true
			);
			logFixture(resDummy, chalk.magenta('[ewelink]'), `[${source}]`);
		}
	}

	private async _syncStatus() {
		const remoteState =
			await this._eWeLinkConfig.connection.getDevicePowerState(
				this._eWeLinkConfig.device.deviceid
			);

		if (!remoteState.state) {
			return;
		}

		await this._setFromRemoteStatus(
			remoteState.state as 'on' | 'off',
			'sync'
		);
	}

	private _startTimer() {
		setInterval(() => this._syncStatus(), 1000 * 10);
	}
}
