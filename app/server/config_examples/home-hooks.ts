import { HomeHooks } from '@server/modules/home-detector/types';

export default {
	phone: {
		home: {
			'lights-on': async (modules) => {
				await modules.keyval.set('room.lights.ceiling', '1');
			},
			'pc-on': async (modules) => {
				await modules.script.script('wake_desktop');
			},
		},
		away: {
			'lights-off': async (modules) => {
				await modules.keyval.set('room.lights', '0');
			},
			'speakers-off': async (modules) => {
				await modules.keyval.set('room.speakers', '0');
			},
		},
	},
} as HomeHooks;
