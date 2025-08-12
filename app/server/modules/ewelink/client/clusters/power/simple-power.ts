/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import type { EwelinkOnOffClusterState } from '../../cluster';
import { EwelinkOnOffCluster } from '../../cluster';

interface Params {
	switch?: 'on' | 'off';
}

export class EwelinkOnOffClusterSimplePower extends EwelinkOnOffCluster<Params> {
	public override _fromState(state: Params): EwelinkOnOffClusterState {
		return {
			enabled: state.switch === 'on',
		};
	}

	public override _toState(state: EwelinkOnOffClusterState): Params {
		return {
			switch: state.enabled ? 'on' : 'off',
		};
	}
}
