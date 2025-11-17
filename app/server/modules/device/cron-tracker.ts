import type { SceneTrigger, SceneId } from '../../../../types/scene';
import { SceneTriggerType } from '../../../../types/scene';
import { logTag } from '../../lib/logging/logger';
import type { SceneAPI } from './scene-api';
import type { SQL } from 'bun';

interface CronState {
	scene_id: string;
	trigger_index: number;
	last_execution_timestamp: number;
}

export class CronTracker {
	private _checkInterval?: Timer;

	public constructor(
		private readonly _sceneAPI: SceneAPI,
		private readonly _sqlDB: SQL
	) {}

	public async initialize(): Promise<void> {
		// Create cron_executions table if it doesn't exist
		const tableExists = await this._sqlDB<{ name: string }[]>`
			SELECT name FROM sqlite_master WHERE type='table' AND name='cron_executions'
		`;

		if (!tableExists.length) {
			await this._sqlDB`
				CREATE TABLE cron_executions (
					scene_id TEXT NOT NULL,
					trigger_index INTEGER NOT NULL,
					last_execution_timestamp INTEGER NOT NULL,
					PRIMARY KEY (scene_id, trigger_index)
				)
			`;
			logTag('CRON', 'blue', 'Created cron_executions table');
		}

		// Check for missed executions on startup
		await this._checkMissedExecutions();

		// Start the periodic check (every 10 seconds)
		this._startScheduler();
	}

	private async _checkMissedExecutions(): Promise<void> {
		logTag('CRON', 'blue', 'Checking for missed interval executions...');

		const scenes = this._sceneAPI.listScenes();
		const now = Date.now();

		for (const scene of scenes) {
			if (!scene.triggers || scene.triggers.length === 0) {
				continue;
			}

			for (let triggerIndex = 0; triggerIndex < scene.triggers.length; triggerIndex++) {
				const triggerWithConditions = scene.triggers[triggerIndex];
				const trigger = triggerWithConditions.trigger;

				if (trigger.type !== SceneTriggerType.CRON) {
					continue;
				}

				// Get last execution time
				const lastExecution = await this._getLastExecution(scene.id, triggerIndex);

				if (!lastExecution) {
					// Never executed before, trigger once
					logTag(
						'CRON',
						'yellow',
						`Scene "${scene.title}" has never run (interval: ${trigger.intervalMinutes} min), triggering once`
					);
					await this._executeCronTrigger(scene.id, triggerIndex, trigger);
				} else {
					// Check if interval has elapsed since last execution
					const minutesSinceLastExecution = (now - lastExecution) / (1000 * 60);
					if (minutesSinceLastExecution >= trigger.intervalMinutes) {
						logTag(
							'CRON',
							'yellow',
							`Scene "${scene.title}" missed execution (${Math.floor(minutesSinceLastExecution)} min since last run), triggering once`
						);
						await this._executeCronTrigger(scene.id, triggerIndex, trigger);
					}
				}
			}
		}

		logTag('CRON', 'green', 'Finished checking missed executions');
	}

	private async _getLastExecution(
		sceneId: SceneId,
		triggerIndex: number
	): Promise<number | null> {
		const result = await this._sqlDB<CronState[]>`
			SELECT last_execution_timestamp
			FROM cron_executions
			WHERE scene_id = ${sceneId} AND trigger_index = ${triggerIndex}
		`;

		if (result.length === 0) {
			return null;
		}

		return result[0].last_execution_timestamp;
	}

	private async _updateLastExecution(
		sceneId: SceneId,
		triggerIndex: number,
		timestamp: number
	): Promise<void> {
		// Use INSERT OR REPLACE for SQLite
		await this._sqlDB`
			INSERT INTO cron_executions (scene_id, trigger_index, last_execution_timestamp)
			VALUES (${sceneId}, ${triggerIndex}, ${timestamp})
			ON CONFLICT (scene_id, trigger_index)
			DO UPDATE SET last_execution_timestamp = ${timestamp}
		`;
	}

	private async _executeCronTrigger(
		sceneId: SceneId,
		triggerIndex: number,
		trigger: SceneTrigger
	): Promise<void> {
		const now = Date.now();

		try {
			await this._sceneAPI.onTrigger(trigger);
			await this._updateLastExecution(sceneId, triggerIndex, now);
		} catch (error) {
			logTag(
				'CRON',
				'red',
				`Failed to execute interval trigger for scene ${sceneId}:`,
				error
			);
		}
	}

	private _startScheduler(): void {
		// Check every 10 seconds
		this._checkInterval = setInterval(() => {
			void this._checkSchedule();
		}, 10000);

		logTag('CRON', 'green', 'Interval scheduler started (checking every 10 seconds)');
	}

	private async _checkSchedule(): Promise<void> {
		const now = Date.now();
		const scenes = this._sceneAPI.listScenes();

		for (const scene of scenes) {
			if (!scene.triggers || scene.triggers.length === 0) {
				continue;
			}

			for (let triggerIndex = 0; triggerIndex < scene.triggers.length; triggerIndex++) {
				const triggerWithConditions = scene.triggers[triggerIndex];
				const trigger = triggerWithConditions.trigger;

				if (trigger.type !== SceneTriggerType.CRON) {
					continue;
				}

				const lastExecution = await this._getLastExecution(scene.id, triggerIndex);

				if (!lastExecution) {
					// Never executed, run now
					logTag(
						'CRON',
						'blue',
						`Triggering scene "${scene.title}" (interval: ${trigger.intervalMinutes} min - first run)`
					);
					await this._executeCronTrigger(scene.id, triggerIndex, trigger);
				} else {
					// Check if interval has elapsed
					const minutesSinceLastExecution = (now - lastExecution) / (1000 * 60);
					if (minutesSinceLastExecution >= trigger.intervalMinutes) {
						logTag(
							'CRON',
							'blue',
							`Triggering scene "${scene.title}" (interval: ${trigger.intervalMinutes} min elapsed)`
						);
						await this._executeCronTrigger(scene.id, triggerIndex, trigger);
					}
				}
			}
		}
	}

	public stop(): void {
		if (this._checkInterval) {
			clearInterval(this._checkInterval);
			this._checkInterval = undefined;
			logTag('CRON', 'yellow', 'Interval scheduler stopped');
		}
	}
}
