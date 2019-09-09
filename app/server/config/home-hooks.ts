import { HomeHooks } from "../modules/home-detector";

export default {
	"***REMOVED***": {
		"home": {
			"lights-on":  (modules) => {
				return modules.keyval.set('room.lights.ceiling', '1');
			}, 
			"pc-on": (modules) => {
				return modules.script.script('wake_desktop');
			}
		},
		"away": {
			"lights-off": (modules) => {
				return modules.keyval.set('room.lights', '0');
			},
			"speakers-off": (modules) => {
				return modules.keyval.set('room.speakers', '0');
			}
		}
	}
} as HomeHooks;