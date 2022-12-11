import { KeyvalKeys } from '../config/keyval-types';
import { HomeHooks } from '../modules/home-detector/types';

export default {
	phone: {
		home: {
			'lights-on': async (modules) => {
				await modules.keyval.set<KeyvalKeys>('room.lights.ceiling', '1');
			},
			'pc-on': async (modules) => {
				await modules.script.script('wake_desktop');
			},
		},
		away: {
			'lights-off': async (modules) => {
				await modules.keyval.set<KeyvalKeys>('room.lights', '0');
			},
			'speakers-off': async (modules) => {
				await modules.keyval.set<KeyvalKeys>('room.speakers', '0');
			},
		},
	},
} as HomeHooks;
