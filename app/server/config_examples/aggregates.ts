import { KeyvalHooks } from '../modules/keyval/types';
import { KeyvalKeys } from '../config/keyval-types';

export default {
	'key-name': {
		on: {
			'lights-on': (modules) => {
				return modules.keyval.set<KeyvalKeys>(
					'room.lights.ceiling',
					'1'
				);
			},
		},
		off: {
			'lights-off': (modules) => {
				return modules.keyval.set<KeyvalKeys>(
					'room.lights.ceiling',
					'0'
				);
			},
		},
	},
} as KeyvalHooks;
