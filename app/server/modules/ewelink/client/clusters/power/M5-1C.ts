/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { EwelinkClusterProxy, EwelinkOnOffCluster } from '../../cluster';
import type { EwelinkOnOffClusterState } from '../../cluster';
import type { EWeLinkConfig } from '../shared';

export interface EwelinkOnOffClusterM51CParams {
	switches: {
		switch: 'on' | 'off';
		outlet: number;
	}[];
}

export class EwelinkOnOffClusterM51CSingle extends EwelinkOnOffCluster {
	protected override getProxy = EwelinkClusterProxy.createGetter<EwelinkOnOffClusterState>({
		fromParams: (state: EwelinkOnOffClusterM51CParams) => ({
			enabled: state.switches[this.outlet].switch === 'on',
		}),
		toParams: (state): EwelinkOnOffClusterM51CParams => ({
			switches: [
				{
					outlet: this.outlet,
					switch: state.enabled ? 'on' : 'off',
				},
			],
		}),
	});

	public constructor(
		eWeLinkConfig: EWeLinkConfig,
		public readonly outlet: number
	) {
		super(eWeLinkConfig);
	}
}
