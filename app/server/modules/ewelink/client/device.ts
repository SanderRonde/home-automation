/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { EwelinkOnOffClusterM51CParams } from './clusters/power/M5-1C';
import { EwelinkOnOffClusterM51CSingle } from './clusters/power/M5-1C';
import type { EWeLinkSharedConfig } from './clusters/shared';
import type { Device } from '../../device/device';
import type { EwelinkCluster } from './cluster';
import { logTag } from '../../../lib/logging/logger';

export abstract class EwelinkDevice implements Device, Disposable {
	public readonly modelName: string;
	public constructor(
		protected readonly _eWeLinkConfig: EWeLinkSharedConfig,
		public readonly clusters: EwelinkCluster<object>[]
	) {
		this.modelName = this._eWeLinkConfig.device.itemData.productModel;
	}

	public getUniqueId(): string {
		return `EWELINK:${this._eWeLinkConfig.device.itemData.deviceid}`;
	}

	public static from(
		eWeLinkConfig: EWeLinkSharedConfig
	): EwelinkDevice | null {
		const model = eWeLinkConfig.device.itemData.productModel;
		switch (model) {
			case 'M5-1C':
				// TODO:(sander)
				return new EwelinkM51CDevice(eWeLinkConfig);
			default:
				logTag('ewelink', 'red', `Unsupported device model: ${model}`);
				return null;
		}
	}

	public [Symbol.dispose](): void {
		for (const cluster of this.clusters) {
			cluster[Symbol.dispose]();
		}
	}
}

class EwelinkM51CDevice extends EwelinkDevice {
	public switches: number;
	public constructor(eWeLinkConfig: EWeLinkSharedConfig) {
		const count = (
			eWeLinkConfig.device.itemData
				.params as unknown as EwelinkOnOffClusterM51CParams
		).switches.length;
		const outlets = Array.from(
			{ length: count },
			(_, i) => new EwelinkOnOffClusterM51CSingle(eWeLinkConfig, i)
		);
		super(eWeLinkConfig, outlets);
		this.switches = count;
	}
}
