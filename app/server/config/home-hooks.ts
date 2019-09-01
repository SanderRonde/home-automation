import { ModuleHookables } from "../modules/home-detector";

type ChangeHooks = ((hookables: ModuleHookables, logObj: any) => void)[];

export default {
	"***REMOVED***": {
		"home": [
			(modules, logObj) => {
				return modules.keyval.set(logObj, 'room.lights.ceiling', '1');
			}
		],
		"away": [
			(modules, logObj) => {
				return modules.keyval.set(logObj, 'room.lights', '0');
			}, (modules, logObj) => {
				return modules.keyval.set(logObj, 'room.speakers', '0');
			}
		]
	}
} as {
	[key: string]: {
		home?: ChangeHooks;
		away?: ChangeHooks;
	}
}