/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { EwelinkPowerBase } from '@server/modules/ewelink/devices/power/base-power';

export interface EwelinkPowerParams {
	switch?: 'on' | 'off';
}

export class EwelinkSimplePower extends EwelinkPowerBase<EwelinkPowerParams> {
	protected override _onRemoteUpdate(): void {}

	protected override _getStatusFromState(state: {
		data: {
			params: EwelinkPowerParams;
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
			} as EwelinkPowerParams,
		});
	}
}
