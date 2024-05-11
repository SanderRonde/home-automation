import { PressureHooks, PRESSURE_REGISTER } from '../modules/pressure/types';
import { ModuleHookables } from '../modules';

export default {
	bed: [
		{
			type: 'range',
			from: 0,
			to: 1010,
			minTime: 2500,
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			handler: (_modules: ModuleHookables) => {
				// Do something
				return PRESSURE_REGISTER.REGISTER_CHANGED;
			},
		},
		{
			type: 'range',
			from: 1010,
			to: 1024,
			minTime: 2500,
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			handler: (_modules: ModuleHookables) => {
				// Do something else
				return PRESSURE_REGISTER.REGISTER_CHANGED;
			},
		},
	],
	chair: [
		{
			type: 'range',
			to: 500,
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			handler: (_modules: ModuleHookables) => {
				// Do something
				return PRESSURE_REGISTER.REGISTER_CHANGED;
			},
		},
		{
			type: 'range',
			from: 500,
			minTime: 5000,
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			handler: (_modules: ModuleHookables) => {
				// Do something else
				return PRESSURE_REGISTER.REGISTER_CHANGED;
			},
		},
	],
} as PressureHooks;
