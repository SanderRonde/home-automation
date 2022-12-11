import { ButtonTriggerType, EwelinkButtonBase } from './base-button';
import { ExternalHandler } from '../../../keyval/external';
import { EWeLinkSharedConfig } from '../shared';

export class EWeLinkPowerButton extends EwelinkButtonBase {
	private _keyvalExternal!: ExternalHandler;

	public constructor(
		eWeLinkConfig: EWeLinkSharedConfig,
		private readonly _keyVal:
			| string[]
			| {
					[K in ButtonTriggerType]?: string[];
			  }
	) {
		super(eWeLinkConfig, {});
		this.setActions({
			[ButtonTriggerType.PRESS]: () =>
				this._onPress(ButtonTriggerType.PRESS),
			[ButtonTriggerType.DOUBLE_PRESS]: () =>
				this._onPress(ButtonTriggerType.DOUBLE_PRESS),
			[ButtonTriggerType.HOLD]: () =>
				this._onPress(ButtonTriggerType.HOLD),
		});
	}

	private async _onPress(button: ButtonTriggerType): Promise<void> {
		const usedKeyval = Array.isArray(this._keyVal)
			? this._keyVal
			: this._keyVal[button];
		if (!usedKeyval) {
			return;
		}
		await Promise.all(
			usedKeyval.map((val) => this._keyvalExternal.toggle(val))
		);
	}

	public async init(): Promise<void> {
		await super.init();
		this._keyvalExternal = new this._eWeLinkConfig.modules.keyval.External(
			{},
			'EWELINK.POWER.INIT'
		);
	}
}
