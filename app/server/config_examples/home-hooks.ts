import type { HomeHooks } from '../modules/home-detector/types';

export default {
	phone: {
		home: {
			'lights-on': async (modules, logObj) => {
				await modules.keyval.set(logObj, 'room.lights.ceiling', '1');
			},
		},
		away: {
			'lights-off': async (modules, logObj) => {
				await modules.keyval.set(logObj, 'room.lights', '0');
			},
			'speakers-off': async (modules, logObj) => {
				await modules.keyval.set(logObj, 'room.speakers', '0');
			},
		},
	},
} as HomeHooks;
