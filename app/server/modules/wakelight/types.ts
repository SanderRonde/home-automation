export interface WakelightConfig {
	deviceIds: string[];
	durationMinutes: number;
}

export interface WakelightDB {
	config?: WakelightConfig;
}

export interface AlarmState {
	alarmTimestamp: number;
	startTimestamp: number;
	deviceIds: string[];
	durationMinutes: number;
}
