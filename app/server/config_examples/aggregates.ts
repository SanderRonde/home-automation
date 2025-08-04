import type { KeyvalHooks } from '../modules/keyval/types';

export default {
	'key-name': {
		on: {
			'lights-on': (modules, logObj) => {
				return modules.keyval.set(logObj, 'room.lights.ceiling', '1');
			},
		},
		off: {
			'lights-off': (modules, logObj) => {
				return modules.keyval.set(logObj, 'room.lights.ceiling', '0');
			},
		},
	},
} as KeyvalHooks;
