// Time range within a temperature state
export interface TemperatureTimeRange {
	id: string;
	name: string;
	days: number[]; // 0=Sunday, 1=Monday, 2=Tuesday, etc.
	startTime: string; // "HH:MM" format
	endTime: string; // "HH:MM" format
	targetTemperature: number;
	roomExceptions?: Record<string, number>;
	enabled: boolean;
}

// Legacy type alias for backward compatibility
export type TemperatureScheduleEntry = TemperatureTimeRange;

// Temperature state containing multiple time ranges
export interface TemperatureState {
	id: string;
	name: string;
	timeRanges: TemperatureTimeRange[];
	isDefault?: boolean; // One state can be the default (time-based fallback)
}

export interface PIDParameters {
	heatingRate: number; // °C per minute
	overshootTimeConstant: number; // minutes of residual heating after stop
	lastUpdated: number; // timestamp
	measurementCount: number; // number of successful measurements
	startTemperature?: number; // temperature at start of measurement
	targetTemperature?: number; // target temperature used in measurement
	completionTime?: number; // minutes to reach target
}

export interface MeasurementSession {
	startTime: number; // timestamp
	startTemperature: number; // initial room temperature
	targetTemperature: number; // target to reach
	roomName: string; // room being measured
	status: 'measuring' | 'completed' | 'cancelled';
	heatingRate?: number; // calculated rate (°C/min)
	completionTime?: number; // when target was reached (timestamp)
	lastTemperature?: number; // last recorded temperature
	lastUpdateTime?: number; // last update timestamp
}
