import {
	SmartHomeLight,
	SmartHomeMixinOnOffKeyval,
} from '../lib/smart-home/smart-home-classes';

const devices = [
	class _ extends SmartHomeMixinOnOffKeyval(SmartHomeLight) {
		id = 'room.lights.ceiling';
		name = 'Ceiling Light';
		nicknames = ['ceiling', 'ceiling light', 'light'];
	},
];
export default devices;
