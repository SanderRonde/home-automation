import { SmartHomeDevice } from '../lib/smart-home/smart-home-classes';

declare class NonAbstractSmartHomeDevice extends SmartHomeDevice {
	public id: string;
	public name: string;
	public nicknames: string[];
}

declare const devices: typeof NonAbstractSmartHomeDevice[];

export default devices;
