import { EwelinkLevelControlCluster } from '../../cluster';

type EwelinkLightPowerPowerParams = {
	ltype?: string;
} & {
	[ltype: string]: {
		br: number;
	};
};

export class EwelinkLevelControlClusterLightbulb extends EwelinkLevelControlCluster<EwelinkLightPowerPowerParams> {
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
