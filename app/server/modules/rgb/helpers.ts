import { LED_NAMES } from '../../lib/constants';

export function getLedFromName(name: string): LED_NAMES | null {
	switch (name) {
		case 'desk':
			return LED_NAMES.DESK_LEDS;
		case 'couch':
			return LED_NAMES.COUCH_LEDS;
		case 'wall':
			return LED_NAMES.WALL_LEDS;
		case 'bed':
			return LED_NAMES.BED_LEDS;
	}
	return null;
}
