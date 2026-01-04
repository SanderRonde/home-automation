import { SettablePromise } from '../../lib/settable-promise';
import { logTag } from '../../lib/logging/logger';
import type { LocationConfigDB } from './types';
import { LocationAPI } from './location-api';
import type { Database } from '../../lib/db';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const Location = new (class Location extends ModuleMeta {
	private _db = new SettablePromise<Database<LocationConfigDB>>();
	public api = new SettablePromise<LocationAPI>();
	public name = 'location';

	public async init(config: ModuleConfig) {
		this._db.set(config.db);

		// Initialize SQLite table for location updates
		const tableExists = await config.sqlDB<{ name: string }[]>`
			SELECT name FROM sqlite_master
			WHERE type='table' AND name='location_updates'
		`;

		if (tableExists.length === 0) {
			await config.sqlDB`
				CREATE TABLE location_updates (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					device_id TEXT NOT NULL,
					timestamp INTEGER NOT NULL,
					latitude REAL NOT NULL,
					longitude REAL NOT NULL,
					accuracy REAL
				)
			`;

			// Create indexes for faster queries
			await config.sqlDB`
				CREATE INDEX idx_location_updates_timestamp ON location_updates(timestamp)
			`;
			await config.sqlDB`
				CREATE INDEX idx_location_updates_device_id ON location_updates(device_id)
			`;

			logTag('location', 'green', 'Created location_updates table');
		} else {
			// Check if we need to migrate the table schema
			const columns = await config.sqlDB<{ name: string }[]>`
				PRAGMA table_info(location_updates)
			`;
			const columnNames = columns.map((c) => c.name);

			// Migrate from old schema if needed
			if (!columnNames.includes('device_id')) {
				logTag('location', 'yellow', 'Migrating location_updates table schema...');
				// Check if we have target_id (old schema) or need to add device_id
				if (columnNames.includes('target_id')) {
					// Migrate from target_id to device_id
					await config.sqlDB`
						CREATE TABLE location_updates_new (
							id INTEGER PRIMARY KEY AUTOINCREMENT,
							device_id TEXT NOT NULL,
							timestamp INTEGER NOT NULL,
							latitude REAL NOT NULL,
							longitude REAL NOT NULL,
							accuracy REAL
						)
					`;
					await config.sqlDB`
						INSERT INTO location_updates_new (device_id, timestamp, latitude, longitude, accuracy)
						SELECT target_id, timestamp, latitude, longitude, accuracy
						FROM location_updates
					`;
					await config.sqlDB`DROP TABLE location_updates`;
					await config.sqlDB`ALTER TABLE location_updates_new RENAME TO location_updates`;
					await config.sqlDB`
						CREATE INDEX idx_location_updates_timestamp ON location_updates(timestamp)
					`;
					await config.sqlDB`
						CREATE INDEX idx_location_updates_device_id ON location_updates(device_id)
					`;
				} else {
					// Just add device_id column
					await config.sqlDB`
						ALTER TABLE location_updates ADD COLUMN device_id TEXT
					`;
					await config.sqlDB`
						CREATE INDEX idx_location_updates_device_id ON location_updates(device_id)
					`;
				}
				logTag('location', 'green', 'Migration complete');
			}
		}

		const api = new LocationAPI(config.db, config.sqlDB);
		this.api.set(api);

		// Migrate old config if needed
		await api.migrateOldConfig();

		return {
			serve: initRouting(api, config),
		};
	}
})();
