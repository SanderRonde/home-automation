import { AllModules } from '../modules/index';

export const LED_NAMES: string[];
export type LED_NAME = typeof LED_NAMES[number];
export const RING_LEDS: Record<
	string,
	[
		LED_NAME,
		{
			numLeds: number;
		}
	]
>;
export const HEX_LEDS: Record<string, LED_NAME>;
export const MAGIC_LEDS: Record<string, LED_NAME>;
export const WLED_LEDS: Record<string, LED_NAME>;
export const LED_KEYVAL_MAP: Record<LED_NAME, string[]>;
export function initRGBListeners(modules: AllModules): Promise<void>;
export function getLedFromName(name: string): LED_NAME | null;
export const COMMON_SWITCH_MAPPINGS: [RegExp, string][];
