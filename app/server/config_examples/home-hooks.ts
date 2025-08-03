import type { HomeHooks } from '../modules/home-detector/types';

export default {
	phone: {
		home: {
			'lights-on': async (modules) => {
				await modules.keyval.set('room.lights.ceiling', '1');
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
