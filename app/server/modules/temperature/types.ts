export interface TemperatureScheduleEntry {
	id: string;
	name: string;
	days: number[]; // 0=Sunday, 1=Monday, 2=Tuesday, etc.
	startTime: string; // "HH:MM" format
	endTime: string; // "HH:MM" format
	targetTemperature: number;
	enabled: boolean;
}
