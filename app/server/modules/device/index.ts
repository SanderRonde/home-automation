import type { IncludedIconNames } from '../../../client/dashboard/components/icon';
import { SceneTriggerType } from '../../../../types/scene.js';
import { SettablePromise } from '../../lib/settable-promise';
import type { DeviceGroup } from '../../../../types/group';
import type { Palette } from '../../../../types/palette';
import { HOME_STATE } from '../home-detector/types.js';
import type { Scene } from '../../../../types/scene';
import type { AllModules, ModuleConfig } from '..';
import { CronTracker } from './cron-tracker';
import type { Database } from '../../lib/db';
import type { DeviceInfo } from './routing';
import { initRouting } from './routing';
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
	private _cronTracker = new SettablePromise<CronTracker>();
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

		// Initialize SQL table for boolean state events
		const booleanStateTableExists = await config.sqlDB<{ name: string }[]>`
			SELECT name FROM sqlite_master WHERE type='table' AND name='boolean_state_events'
		`;

		if (!booleanStateTableExists.length) {
			await config.sqlDB`
				CREATE TABLE boolean_state_events (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					device_id TEXT NOT NULL,
					state BOOLEAN NOT NULL,
					timestamp INTEGER NOT NULL
				)
			`;
			await config.sqlDB`
				CREATE INDEX idx_boolean_state_device_time ON boolean_state_events(device_id, timestamp DESC)
			`;
		}

		// Initialize SQL table for scene executions
		const sceneExecutionsTableExists = await config.sqlDB<{ name: string }[]>`
			SELECT name FROM sqlite_master WHERE type='table' AND name='scene_executions'
		`;

		if (!sceneExecutionsTableExists.length) {
			await config.sqlDB`
				CREATE TABLE scene_executions (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					scene_id TEXT NOT NULL,
					scene_title TEXT NOT NULL,
					timestamp INTEGER NOT NULL,
					trigger_type TEXT NOT NULL,
					trigger_source TEXT,
					success INTEGER NOT NULL
				)
			`;
			await config.sqlDB`
				CREATE INDEX idx_scene_executions_time ON scene_executions(timestamp DESC)
			`;
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
		const api = new DeviceAPI(config.db, config.sqlDB, this.getModules() as unknown);
		this.api.set(api);

		// Initialize CronTracker
		const cronTracker = new CronTracker(api.sceneAPI, config.sqlDB);
		this._cronTracker.set(cronTracker);

		// Subscribe to home-detector state changes to trigger scenes
		const modules = await this.getModules<AllModules>();
		void modules.homeDetector.onUpdate(async (newState: HOME_STATE, hostId: string) => {
			if (newState === HOME_STATE.HOME) {
				await api.sceneAPI.onTrigger({
					type: SceneTriggerType.HOST_ARRIVAL,
					hostId,
				});
			} else {
				await api.sceneAPI.onTrigger({
					type: SceneTriggerType.HOST_DEPARTURE,
					hostId,
				});
			}
		});

		return {
			serve: initRouting(config, api),
		};
	}

	public async postInit(): Promise<void> {
		const cronTracker = await this._cronTracker.value;
		await cronTracker.initialize();
	}
})();
