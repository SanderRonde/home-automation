import { PressureHooks } from '../modules/pressure';

export default {
	bed: [
		{
			type: 'range',
			from: 0,
			to: 1010,
			minTime: 2500,
			handler: _modules => {
				// Do something
			}
		},
		{
			type: 'range',
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
			type: 'range',
			to: 500,
			handler: _modules => {
				// Do something
			}
		},
		{
			type: 'range',
			from: 500,
			minTime: 5000,
			handler: _modules => {
				// Do something else
			}
		}
	]
} as PressureHooks;
