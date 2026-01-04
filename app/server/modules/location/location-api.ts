import type {
	LocationUpdate,
	LocationTarget,
	LocationTargetWithStatus,
	LocationConfigDB,
	LocationUpdateRecord,
	LocationDevice,
} from './types';
import { logTag } from '../../lib/logging/logger';
import type { Database } from '../../lib/db';
import type { SQL } from 'bun';

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371; // Earth's radius in kilometers
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

export class LocationAPI {
	public constructor(
		private readonly _db: Database<LocationConfigDB>,
		private readonly _sqlDB: SQL
	) {}

	/**
	 * Get all targets
	 */
	public getTargets(): LocationTarget[] {
		const targets = this._db.current().targets ?? {};
		return Object.values(targets);
	}

	/**
	 * Get a specific target
	 */
	public getTarget(targetId: string): LocationTarget | null {
		const targets = this._db.current().targets ?? {};
		return targets[targetId] ?? null;
	}

	/**
	 * Create or update a target
	 */
	public setTarget(target: LocationTarget): void {
		// Validate coordinates
		if (target.coordinates.latitude < -90 || target.coordinates.latitude > 90) {
			throw new Error('Latitude must be between -90 and 90');
		}
		if (target.coordinates.longitude < -180 || target.coordinates.longitude > 180) {
			throw new Error('Longitude must be between -180 and 180');
		}

		this._db.update((old) => ({
			...old,
			targets: {
				...(old.targets ?? {}),
				[target.id]: target,
			},
		}));

		logTag('location', 'green', `Target "${target.name}" (${target.id}) set`);
	}

	/**
	 * Delete a target
	 */
	public deleteTarget(targetId: string): boolean {
		const targets = this._db.current().targets ?? {};
		if (!targets[targetId]) {
			return false;
		}

		const newTargets = { ...targets };
		delete newTargets[targetId];

		this._db.update((old) => ({
			...old,
			targets: newTargets,
		}));

		logTag('location', 'green', `Target ${targetId} deleted`);
		return true;
	}

	/**
	 * Get all devices
	 */
	public getDevices(): Array<{ id: string; name: string }> {
		const devices = this._db.current().devices ?? {};
		return Object.values(devices);
	}

	/**
	 * Get a specific device
	 */
	public getDevice(deviceId: string): { id: string; name: string } | null {
		const devices = this._db.current().devices ?? {};
		return devices[deviceId] ?? null;
	}

	/**
	 * Create or update a device
	 */
	public setDevice(device: { id: string; name: string }): void {
		this._db.update((old) => ({
			...old,
			devices: {
				...(old.devices ?? {}),
				[device.id]: device,
			},
		}));

		logTag('location', 'green', `Device "${device.name}" (${device.id}) set`);
	}

	/**
	 * Delete a device
	 */
	public deleteDevice(deviceId: string): boolean {
		const devices = this._db.current().devices ?? {};
		if (!devices[deviceId]) {
			return false;
		}

		const newDevices = { ...devices };
		delete newDevices[deviceId];

		this._db.update((old) => ({
			...old,
			devices: newDevices,
		}));

		logTag('location', 'green', `Device ${deviceId} deleted`);
		return true;
	}

	/**
	 * Get last known location for a device
	 */
	public async getLastLocation(deviceId: string): Promise<LocationUpdateRecord | null> {
		const results = await this._sqlDB<LocationUpdateRecord[]>`
			SELECT * FROM location_updates
			WHERE device_id = ${deviceId}
			ORDER BY timestamp DESC
			LIMIT 1
		`;
		return results[0] ?? null;
	}

	/**
	 * Process a location update from a device
	 */
	public async processLocationUpdate(update: LocationUpdate): Promise<void> {
		// Ensure device exists (create if it doesn't)
		if (!this.getDevice(update.deviceId)) {
			this.setDevice({
				id: update.deviceId,
				name: update.deviceId, // Default name to ID
			});
		}

		const timestamp = update.timestamp ?? Date.now();

		// Store the update in database
		await this._storeLocationUpdate(update, timestamp);
	}

	/**
	 * Store location update in SQLite
	 */
	private async _storeLocationUpdate(update: LocationUpdate, timestamp: number): Promise<void> {
		await this._sqlDB`
			INSERT INTO location_updates (
				device_id,
				timestamp,
				latitude,
				longitude,
				accuracy
			) VALUES (
				${update.deviceId},
				${timestamp},
				${update.latitude},
				${update.longitude},
				${update.accuracy ?? null}
			)
		`;
	}

	/**
	 * Get location history for a device
	 */
	public async getDeviceHistory(deviceId: string, limit = 100): Promise<LocationUpdateRecord[]> {
		return await this._sqlDB<LocationUpdateRecord[]>`
			SELECT * FROM location_updates
			WHERE device_id = ${deviceId}
			ORDER BY timestamp DESC
			LIMIT ${limit}
		`;
	}

	/**
	 * Get all targets with their status
	 */
	public getAllTargetsWithStatus(): LocationTargetWithStatus[] {
		const targets = this.getTargets();
		return targets.map((target) => ({ ...target }));
	}

	/**
	 * Get all devices with their last known location
	 */
	public async getAllDevicesWithStatus(): Promise<LocationDevice[]> {
		const devices = this.getDevices();
		const results: LocationDevice[] = [];

		for (const device of devices) {
			const lastLocation = await this.getLastLocation(device.id);
			results.push({
				...device,
				lastKnownLocation: lastLocation
					? {
							latitude: lastLocation.latitude,
							longitude: lastLocation.longitude,
							accuracy: lastLocation.accuracy,
							timestamp: lastLocation.timestamp,
						}
					: null,
			});
		}

		return results;
	}

	/**
	 * Check if a device is within range of a target
	 */
	public async isDeviceWithinRangeOfTarget(
		deviceId: string,
		targetId: string,
		rangeKm: number
	): Promise<boolean> {
		const deviceLocation = await this.getLastLocation(deviceId);
		if (!deviceLocation) {
			return false;
		}

		const target = this.getTarget(targetId);
		if (!target) {
			return false;
		}

		const distance = haversineDistance(
			deviceLocation.latitude,
			deviceLocation.longitude,
			target.coordinates.latitude,
			target.coordinates.longitude
		);

		return distance <= rangeKm;
	}

	/**
	 * Migrate old home coordinates to a target (if exists)
	 */
	public async migrateOldConfig(): Promise<void> {
		const dbConfig = this._db.current();
		if (dbConfig.targets && Object.keys(dbConfig.targets).length > 0) {
			// Already migrated or has targets
			return;
		}

		// Check for old homeCoordinates
		const oldHomeCoords = (
			dbConfig as unknown as { homeCoordinates?: { latitude: number; longitude: number } }
		).homeCoordinates;
		if (oldHomeCoords) {
			// Create a "home" target from old config
			this.setTarget({
				id: 'home',
				name: 'Home',
				coordinates: oldHomeCoords,
			});

			// Migrate old location updates - if they have target_id, create a device for them
			try {
				const oldUpdates = await this._sqlDB<Array<{ target_id: string }>>`
					SELECT DISTINCT target_id FROM location_updates WHERE target_id IS NOT NULL
				`;
				for (const update of oldUpdates) {
					if (update.target_id && !this.getDevice(update.target_id)) {
						this.setDevice({
							id: update.target_id,
							name: update.target_id,
						});
					}
				}
				logTag('location', 'green', 'Migrated old location data');
			} catch (error) {
				// Table might not have the right columns yet, that's ok
				logTag('location', 'yellow', 'Could not migrate old location updates:', error);
			}
		}
	}
}
