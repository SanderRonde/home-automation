export interface LocationUpdate {
	deviceId: string; // Device sending the location (e.g., "my-phone")
	latitude: number;
	longitude: number;
	accuracy?: number;
	timestamp?: number;
}

export interface LocationTarget {
	id: string;
	name: string;
	coordinates: {
		latitude: number;
		longitude: number;
	};
}

export interface LocationTargetWithStatus extends LocationTarget {
	// Targets are static points, no location tracking needed
}

export interface LocationConfigDB {
	targets?: Record<string, LocationTarget>;
	devices?: Record<string, { id: string; name: string }>;
}

export interface LocationUpdateRecord {
	id: number;
	device_id: string;
	timestamp: number;
	latitude: number;
	longitude: number;
	accuracy: number | null;
}

export interface LocationDevice {
	id: string;
	name: string;
	lastKnownLocation: {
		latitude: number;
		longitude: number;
		accuracy: number | null;
		timestamp: number;
	} | null;
}
