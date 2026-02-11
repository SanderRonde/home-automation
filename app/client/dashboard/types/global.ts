import type { DeviceListWithValuesResponse } from '../../../server/modules/device/routing';

declare global {
	interface Window {
		__debug: {
			devices?: DeviceListWithValuesResponse;
		};
	}
}
