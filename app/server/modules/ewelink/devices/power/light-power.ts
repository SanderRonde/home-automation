import { EwelinkPowerParams } from './simple-power';
import { EwelinkPowerBase } from './base-power';

type EwelinkLightPowerPowerParams = EwelinkPowerParams & {
	ltype?: string;
} & {
	[ltype: string]: {
		br: number;
		ct: number;
	};
};

export class EwelinkLightPower extends EwelinkPowerBase<EwelinkLightPowerPowerParams> {
	/**
	 * 0 to 100
	 */
	// Unused for now
	public brightness: number = 0;
	/**
	 * 0 to 255, where 0 is warm and 255 is cold
	 */
	// Unused for now
	public colorTemperature: number = 0;

	protected _onRemoteUpdate(params: EwelinkLightPowerPowerParams): void {
		if (!params.ltype || !params.switch) {
			return;
		}
		const ltype = params.ltype;
		const ltypeParams = params[ltype];
		if (!ltypeParams) {
			return;
		}

		this.brightness = ltypeParams.br;
		this.colorTemperature = ltypeParams.ct;
	}

	protected override _getStatusFromState(state: {
		data: {
			params: EwelinkLightPowerPowerParams;
		};
	}): boolean {
		return state.data.params.switch === 'on';
	}

	protected override async setPower(isOn: boolean): Promise<void> {
		await this._eWeLinkConfig.connection.setThingStatus({
			id: this._eWeLinkConfig.device.itemData.deviceid,
			type: 1,
			params: {
				switch: isOn ? 'on' : 'off',
			} as EwelinkLightPowerPowerParams,
		});
	}
}
