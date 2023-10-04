export const LED_NAMES: string[] = ['ceiling', 'tv', 'bed'];
export type LED_NAME = typeof LED_NAMES[number];
export const RING_LEDS: Record<
	string,
	[
		LED_NAME,
		{
			numLeds: number;
		}
	]
> = {
	'192.168.0.1': [
		'ceiling',
		{
			numLeds: 1000,
		},
	],
};
export const HEX_LEDS: Record<string, LED_NAME> = {
	'192.168.0.2': 'tv',
};
export const MAGIC_LEDS: Record<string, LED_NAME> = {
	'192.168.0.3': 'bed',
};
export const WLED_LEDS: Record<string, LED_NAME> = {
	'192.168.0.4': 'lamp',
};
export const LED_KEYVAL_MAP: Record<LED_NAME, string[]> = {
	ceiling: ['bedroom.ceiling'],
	tv: ['livingroom.tv'],
	bed: ['bedroom.bed'],
};
export async function initRGBListeners(): Promise<void> {
	// Add any keyval listeners you want
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getLedFromName(_name: string): LED_NAME | null {
	// Resolves when "turn on/off (\w+)" is sent to the bot
	return null;
}
// Sames as above but can use regex and multiple words
export const COMMON_SWITCH_MAPPINGS: [RegExp, string][] = [
	[/((the)\s+)?lights/, 'bedroom.ceiling'],
];
