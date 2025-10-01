import { EwelinkClusterProxy, EwelinkLevelControlCluster } from '../../cluster';
import type { EwelinkLevelControlClusterState } from '../../cluster';

type EwelinkLightPowerPowerParams = {
	ltype?: string;
} & {
	[ltype: string]: {
		br: number;
	};
};

export class EwelinkLevelControlClusterLightbulb extends EwelinkLevelControlCluster {
	protected override getProxy = EwelinkClusterProxy.createGetter<EwelinkLevelControlClusterState>(
		{
			fromParams: (state: EwelinkLightPowerPowerParams) => ({
				level: state.ltype ? state[state.ltype].br : 0,
			}),
			toParams: (state): EwelinkLightPowerPowerParams => {
				const currentState = this._eWeLinkConfig.device.itemData
					.params as EwelinkLightPowerPowerParams;
				if (!currentState.ltype) {
					return {} as EwelinkLightPowerPowerParams;
				}
				return {
					ltype: currentState.ltype,
					[currentState.ltype]: {
						br: state.level,
					},
				} as EwelinkLightPowerPowerParams;
			},
		}
	);
}
