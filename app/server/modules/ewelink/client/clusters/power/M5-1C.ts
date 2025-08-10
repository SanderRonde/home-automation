/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import type { EwelinkOnOffClusterState } from '../../cluster';
import { EwelinkOnOffCluster } from '../../cluster';
import type { EWeLinkSharedConfig } from '../shared';

export interface EwelinkOnOffClusterM51CParams {
	switches: {
		switch: 'on' | 'off';
		outlet: number;
	}[];
}

// TODO:(sander) model name etc.
export class EwelinkOnOffClusterM51CSingle extends EwelinkOnOffCluster<EwelinkOnOffClusterM51CParams> {
	public constructor(
		eWeLinkConfig: EWeLinkSharedConfig,
		public readonly outlet: number
	) {
		super(eWeLinkConfig);
	}

	public override _fromState(state: EwelinkOnOffClusterM51CParams): EwelinkOnOffClusterState {
		return {
			enabled: state.switches[this.outlet].switch === 'on',
		};
	}

	public override _toState(state: EwelinkOnOffClusterState): EwelinkOnOffClusterM51CParams {
		return {
			switches: [
				{
					outlet: this.outlet,
					switch: state.enabled ? 'on' : 'off',
				},
			],
		};
	}
}
