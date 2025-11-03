import { DoorSensorMonitor, MovementSensorMonitor, Detector } from './classes';
import { SettablePromise } from '../../lib/settable-promise';
import { SceneTriggerType } from '../../../../types/scene';
import type { AllModules, ModuleConfig } from '..';
import { logTag } from '../../lib/logging/logger';
import type { HostsConfigDB } from './classes';
import { Database } from '../../lib/db';
import { initRouting } from './routing';
import { HOME_STATE } from './types';
import { ModuleMeta } from '../meta';
import { Bot } from './bot';
import chalk from 'chalk';

export type HomeDetectorDB = Record<string, HOME_STATE>;

export const HomeDetector = new (class HomeDetector extends ModuleMeta {
	private readonly _detector: SettablePromise<Detector> = new SettablePromise();
	private _doorSensorMonitor: DoorSensorMonitor | null = null;
	private _movementSensorMonitor: MovementSensorMonitor | null = null;

	public name = 'home-detector';

	public override get Bot() {
		return Bot;
	}

	public async init(config: ModuleConfig) {
		// Initialize SQL table for home detection events
		const eventsTableExists = await config.sqlDB<{ name: string }[]>`
			SELECT name FROM sqlite_master WHERE type='table' AND name='home_detection_events'
		`;

		if (!eventsTableExists.length) {
			await config.sqlDB`
				CREATE TABLE home_detection_events (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					host_name TEXT NOT NULL,
					state TEXT NOT NULL,
					timestamp INTEGER NOT NULL,
					trigger_type TEXT,
					scenes_triggered TEXT
				)
			`;
			await config.sqlDB`
				CREATE INDEX idx_home_detection_host_time ON home_detection_events(host_name, timestamp DESC)
			`;
		}

		const hostsDb = new Database<HostsConfigDB>('home-detector-hosts.json');
		const detector = new Detector({
			db: config.db as Database<HomeDetectorDB>,
			hostsDb,
			sqlDB: config.sqlDB,
		});
		Bot.init({
			detector,
		});
		this._detector.set(detector);

		let _prevAnyoneHome: boolean | null = null;

		detector.addListener(null, async (newState, name) => {
			logTag(
				`device:${name}`,
				'cyan',
				newState === HOME_STATE.HOME
					? chalk.bold(chalk.blue('now home'))
					: chalk.blue('just left')
			);

			const anyHomeNow = Object.values(detector.getAll()).some((s) => s === HOME_STATE.HOME);
			if (_prevAnyoneHome === null) {
				_prevAnyoneHome = anyHomeNow;
				return;
			}
			if (!_prevAnyoneHome && anyHomeNow) {
				try {
					await deviceAPI.sceneAPI.onTrigger({ type: SceneTriggerType.ANYBODY_HOME });
				} catch (error) {
					logTag('home-detector', 'red', 'Failed to trigger anybody-home scenes:', error);
				}
			} else if (_prevAnyoneHome && !anyHomeNow) {
				try {
					await deviceAPI.sceneAPI.onTrigger({ type: SceneTriggerType.NOBODY_HOME });
				} catch (error) {
					logTag('home-detector', 'red', 'Failed to trigger nobody-home scenes:', error);
				}
			}
			_prevAnyoneHome = anyHomeNow;
		});

		// Initialize door sensor monitoring
		this._doorSensorMonitor = new DoorSensorMonitor(detector, hostsDb);

		// Initialize movement sensor monitoring
		this._movementSensorMonitor = new MovementSensorMonitor(detector, hostsDb);

		// Wait for modules to be available, then subscribe to device updates
		const modules = await this.getModules<AllModules>();
		const deviceAPI = await modules.device.api.value;

		// Periodically check rapid ping completion
		setInterval(() => {
			detector.checkRapidPingCompletion();
		}, 1000);

		// Track devices initially
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		deviceAPI.devices.subscribe((devices: any) => {
			if (this._doorSensorMonitor && devices) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				this._doorSensorMonitor.trackDevices(Object.values(devices));
			}
			if (this._movementSensorMonitor && devices) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				this._movementSensorMonitor.trackDevices(Object.values(devices));
			}
		});

		// Set up notification and scene trigger when rapid ping completes without any arrivals
		detector.addRapidPingListener(async (anyoneHome) => {
			if (!anyoneHome) {
				logTag(
					'home-detector',
					'yellow',
					'Door triggered but no one came home - sending notification'
				);
				try {
					const pushManager = await modules.notification.getPushManager();
					await pushManager.sendDoorSensorAlert();
				} catch (error) {
					logTag('home-detector', 'red', 'Failed to send door sensor alert:', error);
				}
				try {
					await deviceAPI.sceneAPI.onTrigger({
						type: SceneTriggerType.NOBODY_HOME_TIMEOUT,
					});
				} catch (error) {
					logTag(
						'home-detector',
						'red',
						'Failed to trigger nobody-home-timeout scenes:',
						error
					);
				}
			}
		});

		return {
			serve: initRouting(detector, config),
		};
	}

	public async onUpdate(
		handler: (newState: HOME_STATE, name: string) => void | Promise<void>
	): Promise<void> {
		(await this._detector.value).addListener(null, handler);
	}

	public async getDetector(): Promise<Detector> {
		return await this._detector.value;
	}

	public getDoorSensorMonitor(): DoorSensorMonitor | null {
		return this._doorSensorMonitor;
	}
})();
