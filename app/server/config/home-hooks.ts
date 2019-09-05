import { createHook, HomeHooks } from "../modules/home-detector";

export default {
	"***REMOVED***": {
		"home": [createHook('lights-on', (modules) => {
			return modules.keyval.set('room.lights.ceiling', '1');
		}), createHook('pc-on', (modules) => {
			return modules.script.script('wake_desktop');
		})],
		"away": [
			createHook('lights-off', (modules) => {
				return modules.keyval.set('room.lights', '0');
			}), createHook('speakers-off', (modules) => {
				return modules.keyval.set('room.speakers', '0');
			})
		]
	}
} as HomeHooks;