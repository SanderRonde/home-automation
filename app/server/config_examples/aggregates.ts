import { KeyvalHooks } from '@server/modules/keyval/types';

export default {
	'key-name': {
		on: {
			'lights-on': (modules) => {
				return modules.keyval.set('room.lights.ceiling', '1');
			},
		},
		off: {
			'lights-off': (modules) => {
				return modules.keyval.set('room.lights.ceiling', '0');
			},
		},
	},
} as KeyvalHooks;
