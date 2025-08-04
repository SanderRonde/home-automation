/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type {
	EWeLinkSharedConfig,
	EWeLinkUpdateMessage,
	EWeLinkWebSocketMessage,
} from '../shared';
import { ResDummy } from '../../../../lib/logging/response-logger';
import { LogObj } from '../../../../lib/logging/lob-obj';
import { asyncSetInterval } from '../../../../lib/util';
import { EWeLinkInitable } from '../shared';
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

	private async _setFromRemoteStatus(remoteState: boolean, source: string) {
		const logObj = LogObj.fromFixture(chalk.magenta('[ewelink]'), source);
		const resDummy = new ResDummy();
		const localState = await this._eWeLinkConfig.modules.keyval.get(
			logObj,
			this._keyVal
		);

		if (remoteState !== (localState === '1')) {
			await this._eWeLinkConfig.modules.keyval.set(
				logObj,
				this._keyVal,
				remoteState ? '1' : '0',
				true
			);
			LogObj.fromRes(resDummy).transferTo(logObj);
			logObj.attachMessage('Set to', remoteState ? 'on' : 'off');
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

	public init(): Promise<void> {
		if (this._options.enableSync) {
			this._startTimer();
		}
		this._eWeLinkConfig.modules.keyval.onChange(
			LogObj.fromEvent('EWELINK.INIT'),
			this._keyVal,
			async (value: string) => {
				if (value === '1') {
					await this.turnOn();
				} else {
					await this.turnOff();
				}
			}
		);

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

		return Promise.resolve();
	}

	public turnOn(): Promise<void> {
		return this.setPower(true);
	}

	public turnOff(): Promise<void> {
		return this.setPower(false);
	}
}
