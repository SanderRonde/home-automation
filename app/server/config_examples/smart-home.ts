import {
	SmartHomeLight,
	SmartHomeMixinOnOffKeyval,
} from '@server/lib/smart-home/smart-home-classes';

const devices = [
	class _ extends SmartHomeMixinOnOffKeyval(SmartHomeLight) {
		public id = 'room.lights.ceiling';
		public name = 'Ceiling Light';
		public nicknames = ['ceiling', 'ceiling light', 'light'];
	},
];
export default devices;
