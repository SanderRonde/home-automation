import type { DeviceBooleanStateCluster } from '../../../../device/cluster';
import { EwelinkBooleanStateCluster } from '../../cluster';

interface Params {
	/**
	 * 0=closed, 1=open
	 */
	lock: 0 | 1;
}

export class EwelinkBooleanStateDoorSensorCluster
	extends EwelinkBooleanStateCluster<Params>
	implements DeviceBooleanStateCluster<boolean>
{
	public override _fromState(state: Params): { state: boolean } {
		return {
			state: state.lock === 0,
		};
	}

	public override _toState(state: { state: boolean }): Params {
		return {
			lock: state.state ? 0 : 1,
		};
	}
}
