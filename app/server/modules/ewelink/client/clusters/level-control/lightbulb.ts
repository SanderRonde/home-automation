import { EwelinkLevelControlCluster } from '../../cluster';
import { EWeLinkConfig } from '../shared';

type EwelinkLightPowerPowerParams = {
	ltype?: string;
} & {
	[ltype: string]: {
		br: number;
	};
};

export class EwelinkLevelControlClusterLightbulb extends EwelinkLevelControlCluster<EwelinkLightPowerPowerParams> {
	public constructor(protected readonly _eWeLinkConfig: EWeLinkConfig) {
		super(_eWeLinkConfig, 'Brightness');
	}

	public currentLevel = this.getProxy().attributeGetter((value) =>
		value?.ltype ? value[value.ltype].br : 0
	);

	public setLevel = this.getProxy().attributeSetter(
		(args: { level: number; transitionTimeDs?: number }, currentState) => {
			if (!currentState?.ltype) {
				return {} as EwelinkLightPowerPowerParams;
			}
			return {
				ltype: currentState.ltype,
				[currentState.ltype]: {
					br: args.level,
				},
			} as EwelinkLightPowerPowerParams;
		}
	);
}
