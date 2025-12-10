export interface TemperatureScheduleEntry {
	id: string;
	name: string;
	roomName: string; // Which room this schedule applies to (required)
	days: number[]; // 0=Sunday, 1=Monday, 2=Tuesday, etc.
	startTime: string; // "HH:MM" format
	endTime: string; // "HH:MM" format
	targetTemperature: number;
	enabled: boolean;
}

export interface RoomThermostatStatus {
	roomName: string;
	thermostats: Array<{
		deviceId: string;
		deviceName: string;
		currentTemperature: number;
		targetTemperature: number;
		isHeating: boolean;
		mode: string;
	}>;
	/** Average temperature reported by thermostats in this room */
	averageThermostatTemperature: number;
	/** Average temperature from temperature sensors in this room */
	averageSensorTemperature: number | null;
	/** Whether any thermostat in this room is actively heating */
	isHeating: boolean;
	/** Average target temperature across thermostats */
	targetTemperature: number;
}

export interface HouseHeatingStatus {
	/** Rooms that are currently heating */
	heatingRooms: string[];
	/** Total number of rooms with thermostats */
	totalRoomsWithThermostats: number;
	/** Whether the central thermostat should be heating */
	centralShouldHeat: boolean;
	/** Central thermostat status (if configured) */
	centralThermostat: {
		deviceId: string;
		currentTemperature: number;
		targetTemperature: number;
		isHeating: boolean;
		mode: string;
	} | null;
}
