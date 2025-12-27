import * as suncalc from 'suncalc';

export interface SunPosition {
	azimuth: number; // in radians, 0 = north, clockwise
	altitude: number; // in radians, 0 = horizon, positive = above horizon
}

/**
 * Calculates the sun position (azimuth and altitude) for a given date, time, and location.
 * @param date - The date and time to calculate for
 * @param latitude - Latitude in degrees (-90 to 90)
 * @param longitude - Longitude in degrees (-180 to 180)
 * @returns Sun position with azimuth and altitude in radians
 */
export function calculateSunPosition(date: Date, latitude: number, longitude: number): SunPosition {
	const position = suncalc.getPosition(date, latitude, longitude);
	return {
		azimuth: position.azimuth, // Already in radians, 0 = north, clockwise
		altitude: position.altitude, // Already in radians, 0 = horizon, positive = above
	};
}

/**
 * Calculates the distance between two sun positions.
 * Uses weighted distance where altitude is weighted more heavily since it changes more slowly.
 * @param pos1 - First sun position
 * @param pos2 - Second sun position
 * @returns Distance metric (lower = closer match)
 */
export function calculateSunPositionDifference(pos1: SunPosition, pos2: SunPosition): number {
	// Normalize azimuth difference to account for circular nature (0-2π)
	let azimuthDiff = Math.abs(pos1.azimuth - pos2.azimuth);
	if (azimuthDiff > Math.PI) {
		azimuthDiff = 2 * Math.PI - azimuthDiff;
	}

	const altitudeDiff = Math.abs(pos1.altitude - pos2.altitude);

	// Weighted distance: altitude changes more slowly, so weight it more
	// Weights: azimuth ~1.0, altitude ~1.5
	const weightAzimuth = 1.0;
	const weightAltitude = 1.5;

	return Math.sqrt(
		Math.pow(azimuthDiff * weightAzimuth, 2) + Math.pow(altitudeDiff * weightAltitude, 2)
	);
}
