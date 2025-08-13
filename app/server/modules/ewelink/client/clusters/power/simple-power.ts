/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import type { EwelinkOnOffClusterState } from '../../cluster';
import { EwelinkClusterProxy } from '../../cluster';
import { EwelinkOnOffCluster } from '../../cluster';

interface Params {
	switch?: 'on' | 'off';
}

export class EwelinkOnOffClusterSimplePower extends EwelinkOnOffCluster {
	protected getProxy =
		EwelinkClusterProxy.createGetter<EwelinkOnOffClusterState>({
			fromParams: (state: Params) => ({
				enabled: state.switch === 'on',
			}),
			toParams: (state): Params => ({
				switch: state.enabled ? 'on' : 'off',
			}),
		});
}
