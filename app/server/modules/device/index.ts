import type { IncludedIconNames } from '../../../client/dashboard/components/icon';
import { SettablePromise } from '../../lib/settable-promise';
import type { DeviceGroup } from '../../../../types/group';
import type { Palette } from '../../../../types/palette';
import type { Scene } from '../../../../types/scene';
import type { Database } from '../../lib/db';
import type { DeviceInfo } from './routing';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';
import { DeviceAPI } from './api';

export interface DeviceDB {
	device_registry: Record<string, DeviceInfo>;
	room_icons?: {
		[room: string]: IncludedIconNames;
	};
	scenes?: Record<string, Scene>;
	groups?: Record<string, DeviceGroup>;
	palettes?: Record<string, Palette>;
}

export const Device = new (class Device extends ModuleMeta {
	private _db = new SettablePromise<Database<DeviceDB>>();
	public api = new SettablePromise<DeviceAPI>();
	public name = 'device';

	public async init(config: ModuleConfig) {
		// Initialize routing
		this._db.set(config.db);

		// Initialize SQL table for occupancy events
		const occupancyTableExists = await config.sqlDB<{ name: string }[]>`
			SELECT name FROM sqlite_master WHERE type='table' AND name='occupancy_events'
		`;

		if (!occupancyTableExists.length) {
			await config.sqlDB`
				CREATE TABLE occupancy_events (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					device_id TEXT NOT NULL,
					occupied BOOLEAN NOT NULL,
					timestamp INTEGER NOT NULL
				)
			`;
			await config.sqlDB`
				CREATE INDEX idx_occupancy_device_time ON occupancy_events(device_id, timestamp DESC)
			`;
		}

		// Initialize SQL table for temperature events
		const temperatureTableExists = await config.sqlDB<{ name: string }[]>`
			SELECT name FROM sqlite_master WHERE type='table' AND name='temperature_events'
		`;

		if (!temperatureTableExists.length) {
			await config.sqlDB`
				CREATE TABLE temperature_events (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					device_id TEXT NOT NULL,
					temperature REAL NOT NULL,
					timestamp INTEGER NOT NULL
				)
			`;
			await config.sqlDB`
				CREATE INDEX idx_temperature_device_time ON temperature_events(device_id, timestamp DESC)
			`;
		}

		// Initialize SQL table for humidity events
		const humidityTableExists = await config.sqlDB<{ name: string }[]>`
			SELECT name FROM sqlite_master WHERE type='table' AND name='humidity_events'
		`;

		if (!humidityTableExists.length) {
			await config.sqlDB`
				CREATE TABLE humidity_events (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					device_id TEXT NOT NULL,
					humidity REAL NOT NULL,
					timestamp INTEGER NOT NULL
				)
			`;
			await config.sqlDB`
				CREATE INDEX idx_humidity_device_time ON humidity_events(device_id, timestamp DESC)
			`;
		}

		// Initialize SQL table for illuminance events
		const illuminanceTableExists = await config.sqlDB<{ name: string }[]>`
			SELECT name FROM sqlite_master WHERE type='table' AND name='illuminance_events'
		`;

		if (!illuminanceTableExists.length) {
			await config.sqlDB`
				CREATE TABLE illuminance_events (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					device_id TEXT NOT NULL,
					illuminance REAL NOT NULL,
					timestamp INTEGER NOT NULL
				)
			`;
			await config.sqlDB`
				CREATE INDEX idx_illuminance_device_time ON illuminance_events(device_id, timestamp DESC)
			`;
		}

		// Initialize SQL table for button press events
		const buttonPressTableExists = await config.sqlDB<{ name: string }[]>`
			SELECT name FROM sqlite_master WHERE type='table' AND name='button_press_events'
		`;

		if (!buttonPressTableExists.length) {
			await config.sqlDB`
				CREATE TABLE button_press_events (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					device_id TEXT NOT NULL,
					button_index INTEGER,
					timestamp INTEGER NOT NULL
				)
			`;
			await config.sqlDB`
				CREATE INDEX idx_button_press_device_time ON button_press_events(device_id, timestamp DESC)
			`;
		}

		const api = new DeviceAPI(config.db, config.sqlDB);
		this.api.set(api);

		// Subscribe to home-detector state changes to trigger scenes
		const modules = await this.modules;
		modules.homeDetector.onUpdate(async (newState, hostId) => {
			const { HOME_STATE } = await import('../home-detector/types.js');
			if (newState === HOME_STATE.HOME) {
				await api.sceneAPI.onTrigger({
					type: 'host-arrival',
					hostId,
				});
			} else {
				await api.sceneAPI.onTrigger({
					type: 'host-departure',
					hostId,
				});
			}
		});

		return {
			serve: initRouting(config, api),
		};
	}
})();
