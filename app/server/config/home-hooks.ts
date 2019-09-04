import { ModuleHookables } from "../modules/home-detector";

interface ChangeHook {
	name: string;
	fn: ((hookables: ModuleHookables, logObj: any) => void);
};

function createHook(name: string, 
	fn: (hookables: ModuleHookables, logObj: any) => void) {
		return {
			name, fn
		}
	}

export default {
	"***REMOVED***": {
		"home": [createHook('lights-on', (modules, logObj) => {
			return modules.keyval.set(logObj, 'room.lights.ceiling', '1');
		})],
		"away": [
			createHook('lights-off', (modules, logObj) => {
				return modules.keyval.set(logObj, 'room.lights', '0');
			}), createHook('speakers-off', (modules, logObj) => {
				return modules.keyval.set(logObj, 'room.speakers', '0');
			})
		]
	}
} as {
	[key: string]: {
		home?: ChangeHook[];
		away?: ChangeHook[];
	}
}