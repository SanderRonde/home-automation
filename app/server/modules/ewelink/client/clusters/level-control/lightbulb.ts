import type { EwelinkLevelControlClusterState } from '../../cluster';
import { EwelinkLevelControlCluster } from '../../cluster';

type EwelinkLightPowerPowerParams = {
	ltype?: string;
} & {
	[ltype: string]: {
		br: number;
	};
};

export class EwelinkLevelControlClusterLightbulb extends EwelinkLevelControlCluster<EwelinkLightPowerPowerParams> {
	protected _fromState(
		state: EwelinkLightPowerPowerParams
	): EwelinkLevelControlClusterState {
		return {
			level: state.ltype ? state[state.ltype].br : 0,
		};
	}

	protected _toState(
		state: EwelinkLevelControlClusterState
	): EwelinkLightPowerPowerParams {
		const currentState = this._eWeLinkConfig.device.itemData.params as EwelinkLightPowerPowerParams;
		if (!currentState.ltype) {
			return {} as EwelinkLightPowerPowerParams;
		}
		return {
			ltype: currentState.ltype,
			[currentState.ltype]: {
				br: state.level,
			},
		} as EwelinkLightPowerPowerParams;
	}
}
