import { EwelinkBooleanStateCluster } from '../../cluster';

interface Params {
	/**
	 * 0=closed, 1=open
	 */
	lock: 0 | 1;
}

export class EwelinkBooleanStateDoorSensorCluster extends EwelinkBooleanStateCluster<Params> {
	public state = this.getProxy().attributeGetter((value) => value?.lock === 0);
}
