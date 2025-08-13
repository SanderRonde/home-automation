import { EwelinkBooleanStateCluster, EwelinkClusterProxy } from '../../cluster';

interface Params {
	/**
	 * 0=closed, 1=open
	 */
	lock: 0 | 1;
}

export class EwelinkBooleanStateDoorSensorCluster extends EwelinkBooleanStateCluster {
	protected getProxy = EwelinkClusterProxy.createGetter<{ state: boolean }>({
		fromParams: (state: Params) => ({
			state: state.lock === 0,
		}),
		toParams: (state): Params => ({
			lock: state.state ? 0 : 1,
		}),
	});
}
