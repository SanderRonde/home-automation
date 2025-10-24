/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { EwelinkOnOffCluster } from '../../cluster';

interface Params {
	switch?: 'on' | 'off';
}

export class EwelinkOnOffClusterSimplePower extends EwelinkOnOffCluster<Params> {
	public isOn = this.getProxy().attributeGetter((value) => value?.switch === 'on');

	public setOn = this.getProxy().attributeSetter((enabled: boolean) => {
		return {
			switch: enabled ? 'on' : 'off',
		};
	});
}
