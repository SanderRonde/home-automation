/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { EwelinkOnOffCluster } from '../../cluster';
import type { EWeLinkConfig } from '../shared';

interface Params {
	switches: {
		switch: 'on' | 'off';
		outlet: number;
	}[];
}

export class EwelinkMultiOnOffCluster extends EwelinkOnOffCluster<Params> {
	public isOn = this.getProxy().attributeGetter(
		(value) => value?.switches[this.outlet].switch === 'on'
	);

	public setOn = this.getProxy().attributeSetter((enabled: boolean, previous: Params | null) => {
		const previousSwitches = previous?.switches ?? [];
		for (const previousSwitch of previousSwitches) {
			if (previousSwitch.outlet === this.outlet) {
				previousSwitch.switch = enabled ? 'on' : 'off';
			}
		}
		return {
			switches: previousSwitches,
		};
	});

	public constructor(
		eWeLinkConfig: EWeLinkConfig,
		public readonly outlet: number
	) {
		super(eWeLinkConfig);
	}
}
