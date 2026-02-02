/**
 * Tuya API call source labels for tracking and rate-limit visibility.
 */
export const TUYA_API_SOURCE = {
	initialization: 'initialization',
	polling: 'polling',
	onDemand: 'on-demand',
	temperatureControl: 'temperature-control',
} as const;

export type TuyaApiSource = (typeof TUYA_API_SOURCE)[keyof typeof TUYA_API_SOURCE];

export interface TuyaApiCallMeta {
	source: string;
	endpoint: string;
	deviceId?: string | null;
}

export type TuyaApiCallRecorder = (
	source: string,
	endpoint: string,
	deviceId?: string | null
) => void;
