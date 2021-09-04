import { ButtonTriggerType, EwelinkButtonBase } from './base-button';
import { EWeLinkSharedConfig } from '../shared';
import { ExternalHandler } from '../../../keyval/external';

export class EWeLinkPowerButton extends EwelinkButtonBase {
	private _keyvalExternal!: ExternalHandler;

	constructor(
		_eWeLinkConfig: EWeLinkSharedConfig,
		private _keyVal:
			| string
			| {
					[K in ButtonTriggerType]?: string;
			  }
	) {
		super(_eWeLinkConfig, {});
		this.setActions({
			[ButtonTriggerType.PRESS]: () =>
				this._onPress(ButtonTriggerType.PRESS),
			[ButtonTriggerType.DOUBLE_PRESS]: () =>
				this._onPress(ButtonTriggerType.DOUBLE_PRESS),
			[ButtonTriggerType.HOLD]: () =>
				this._onPress(ButtonTriggerType.HOLD),
		});
	}

	async init(): Promise<void> {
		await super.init();
		this._keyvalExternal = new this._eWeLinkConfig.modules.keyval.External(
			{},
			'EWELINK.POWER.INIT'
		);
	}

	private async _onPress(button: ButtonTriggerType): Promise<void> {
		const usedKeyval =
			typeof this._keyVal === 'string'
				? this._keyVal
				: this._keyVal[button];
		if (!usedKeyval) {
			return;
		}
		await this._keyvalExternal.toggle(usedKeyval);
	}
}
