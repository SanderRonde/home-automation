import { PressureHooks } from '../modules/pressure';

export default {
	bed: [
		{
			from: 0,
			to: 1010,
			minTime: 2500,
			handler: _modules => {
				// Do something
			}
		},
		{
			from: 1010,
			to: 1024,
			minTime: 2500,
			handler: _modules => {
				// Do something else
			}
		}
	],
	chair: [
		{
			to: 500,
			handler: _modules => {
				// Do something
			}
		},
		{
			from: 500,
			minTime: 5000,
			handler: _modules => {
				// Do something else
			}
		}
	]
} as PressureHooks;
