/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
	EWeLinkInitable,
	EWeLinkSharedConfig,
	EWeLinkUpdateMessage,
	EWeLinkWebSocketMessage,
} from '../shared';
import { logFixture, ResDummy } from '../../../../lib/logger';
import { asyncSetInterval } from '../../../../lib/util';
import chalk from 'chalk';

export abstract class EwelinkPowerBase<P> extends EWeLinkInitable {
	private readonly _options: {
		enableSync: boolean;
	};

	public constructor(
		protected readonly _eWeLinkConfig: EWeLinkSharedConfig,
		private readonly _keyVal: string,
		options?: {
			enableSync?: boolean;
		}
	) {
		super();
		this._options = {
			enableSync: options?.enableSync ?? true,
		};
	}

	private _getKeyval() {
		const resDummy = new ResDummy();
		return {
			resDummy,
			keyval: new this._eWeLinkConfig.modules.keyval.External(resDummy),
		};
	}

	private async _setFromRemoteStatus(remoteState: boolean, source: string) {
		const { keyval, resDummy } = this._getKeyval();
		const localState = await keyval.get(this._keyVal);

		if (remoteState !== (localState === '1')) {
			await keyval.set(this._keyVal, remoteState ? '1' : '0', true);
			logFixture(
				resDummy,
				chalk.magenta('[ewelink]'),
				`[${source}]`,
				'Set to',
				remoteState ? 'on' : 'off'
			);
		}
	}

	private async _syncStatus() {
		const status = await this._eWeLinkConfig.connection.getThingStatus<{
			data: {
				params: P;
			};
		}>({
			id: this._eWeLinkConfig.device.itemData.deviceid,
			// Type 1 means deviceid
			type: 1,
		});

		if (!status) {
			return;
		}

		await this._setFromRemoteStatus(
			this._getStatusFromState(status),
			'sync'
		);
	}

	private _startTimer() {
		asyncSetInterval(() => this._syncStatus(), 1000 * 300);
	}

	protected abstract _onRemoteUpdate(
		params: EWeLinkUpdateMessage<P>['params']
	): void;

	protected abstract _getStatusFromState(state: {
		data: {
			params: P;
		};
	}): boolean;

	protected abstract setPower(isOn: boolean): Promise<void>;

	public async init(): Promise<void> {
		if (this._options.enableSync) {
			this._startTimer();
		}
		const { keyval } = this._getKeyval();
		await keyval.onChange(this._keyVal, async (value: string) => {
			if (value === '1') {
				await this.turnOn();
			} else {
				await this.turnOff();
			}
		});

		this._eWeLinkConfig.wsConnection.on(
			'data',
			(data: EWeLinkWebSocketMessage<P>) => {
				if (
					typeof data === 'string' ||
					!('action' in data) ||
					data.action !== 'update' ||
					data.deviceid !==
						this._eWeLinkConfig.device.itemData.deviceid
				) {
					return;
				}

				this._onRemoteUpdate(data.params);
				// await this._setFromRemoteStatus(
				// 	data.params.switch,
				// 	'websocket'
				// );
			}
		);
	}

	public turnOn(): Promise<void> {
		return this.setPower(true);
	}

	public turnOff(): Promise<void> {
		return this.setPower(false);
	}
}
