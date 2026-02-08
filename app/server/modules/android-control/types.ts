/**
 * Profiles are hardcoded in code; the DB does not store the list of profiles.
 */
export enum AndroidControlProfile {
	CREATE_HOME_FAN = 'create-home-fan',
}

export interface AndroidControlDeviceEntry {
	profile: AndroidControlProfile;
	deviceId: string;
}

export interface AndroidControlDB {
	/** One entry per profile the user has configured; maps profile to ADB device ID. */
	androidDevices?: AndroidControlDeviceEntry[];
}
