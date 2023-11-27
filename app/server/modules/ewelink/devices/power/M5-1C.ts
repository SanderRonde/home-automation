/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { EwelinkPowerBase } from './base-power';

interface PowerParams {
	switches: {
		switch: 'on' | 'off';
		outlet: number;
	}[];
}

export class EwelinkM51C extends EwelinkPowerBase<PowerParams> {
	protected _onRemoteUpdate(): void {}

	protected override _getStatusFromState(state: PowerParams): boolean {
		return state.switches[0].switch === 'on';
	}

	protected override async setPower(isOn: boolean): Promise<void> {
		await this._eWeLinkConfig.connection.setThingStatus({
			id: this._eWeLinkConfig.device.itemData.deviceid,
			type: 1,
			params: {
				switches: [
					{
						outlet: 0,
						switch: isOn ? 'on' : 'off',
					},
				],
			} as PowerParams,
		});
	}
}
