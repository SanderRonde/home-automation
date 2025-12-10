import type { TemperatureScheduleEntry } from './types';
import { logTag } from '../../lib/logging/logger';
import { Temperature } from './index';
import type { AllModules } from '..';

/**
 * Temperature Schedule Executor
 * Checks every minute if a schedule boundary has been crossed and applies the new temperature
 * Now supports room-level schedules - applies to specific room thermostats
 */
export class TemperatureScheduler {
	private readonly _modules: AllModules;
	private _intervalId: ReturnType<typeof setInterval> | null = null;
	private _lastAppliedScheduleIds: Set<string> = new Set();
	private _lastCheckMinute: number = -1;

	public constructor(modules: AllModules) {
		this._modules = modules;
	}

	/**
	 * Start the scheduler - checks every minute
	 */
	public start(): void {
		if (this._intervalId) {
			return; // Already running
		}

		logTag('temperature', 'blue', 'Starting temperature scheduler');

		// Check immediately on start
		void this._checkSchedule();

		// Then check every minute
		this._intervalId = setInterval(() => {
			void this._checkSchedule();
		}, 60000);
	}

	/**
	 * Stop the scheduler
	 */
	public stop(): void {
		if (this._intervalId) {
			clearInterval(this._intervalId);
			this._intervalId = null;
			logTag('temperature', 'blue', 'Stopped temperature scheduler');
		}
	}

	/**
	 * Check if we need to apply new schedules
	 * Now checks all room-specific schedules
	 */
	private async _checkSchedule(): Promise<void> {
		const now = new Date();
		const currentMinute = now.getHours() * 60 + now.getMinutes();

		// Avoid running multiple times in the same minute
		if (currentMinute === this._lastCheckMinute) {
			return;
		}
		this._lastCheckMinute = currentMinute;

		const currentDay = now.getDay();

		// Get all schedules and check each one
		const schedule = Temperature.getSchedule();
		const enabledSchedules = schedule.filter((s) => s.enabled);

		if (enabledSchedules.length === 0) {
			return;
		}

		// Check each schedule to see if it should trigger now
		for (const entry of enabledSchedules) {
			// Skip if not applicable today
			if (!entry.days.includes(currentDay)) {
				continue;
			}

			const [startHour, startMinute] = entry.startTime.split(':').map(Number);
			const scheduleStartMinutes = startHour * 60 + startMinute;

			// Check if we're within the first minute of the schedule start
			if (Math.abs(currentMinute - scheduleStartMinutes) <= 1) {
				const scheduleKey = this._getScheduleKey(entry, now);

				// Skip if already applied
				if (this._lastAppliedScheduleIds.has(scheduleKey)) {
					continue;
				}

				// Apply the schedule to the specific room
				await this._applyRoomSchedule(entry);
				this._lastAppliedScheduleIds.add(scheduleKey);

				// Clean up old keys (from previous days)
				this._cleanupOldKeys(now);
			}
		}
	}

	/**
	 * Apply a schedule to its target room
	 */
	private async _applyRoomSchedule(entry: TemperatureScheduleEntry): Promise<void> {
		const roomName = entry.roomName;

		logTag(
			'temperature',
			'green',
			`Applying scheduled temperature for ${roomName}: ${entry.targetTemperature}°C (schedule: ${entry.name}, ${entry.startTime}-${entry.endTime})`
		);

		const success = await Temperature.setRoomThermostatTarget(
			roomName,
			entry.targetTemperature,
			this._modules
		);

		if (success) {
			logTag(
				'temperature',
				'green',
				`Successfully applied scheduled temperature for ${roomName}: ${entry.targetTemperature}°C`
			);
		} else {
			logTag(
				'temperature',
				'red',
				`Failed to apply scheduled temperature for ${roomName}: ${entry.targetTemperature}°C`
			);
		}
	}

	/**
	 * Generate a unique key for a schedule entry on a specific day
	 * This helps track whether we've already applied a schedule
	 */
	private _getScheduleKey(schedule: TemperatureScheduleEntry, date: Date): string {
		const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
		return `${schedule.id}-${schedule.roomName}-${dateStr}-${schedule.startTime}`;
	}

	/**
	 * Remove schedule keys from previous days to prevent memory buildup
	 */
	private _cleanupOldKeys(currentDate: Date): void {
		const currentDateStr = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}`;
		const keysToRemove: string[] = [];

		for (const key of this._lastAppliedScheduleIds) {
			// Extract the date part from the key
			const parts = key.split('-');
			if (parts.length >= 4) {
				const keyDateStr = `${parts[1]}-${parts[2]}-${parts[3]}`;
				if (keyDateStr !== currentDateStr) {
					keysToRemove.push(key);
				}
			}
		}

		for (const key of keysToRemove) {
			this._lastAppliedScheduleIds.delete(key);
		}
	}
}

let schedulerInstance: TemperatureScheduler | null = null;

/**
 * Initialize the temperature scheduler
 * Should be called once during module initialization
 */
export function initScheduler(modules: AllModules): TemperatureScheduler {
	if (schedulerInstance) {
		schedulerInstance.stop();
	}
	schedulerInstance = new TemperatureScheduler(modules);
	schedulerInstance.start();
	return schedulerInstance;
}

/**
 * Get the current scheduler instance
 */
export function getScheduler(): TemperatureScheduler | null {
	return schedulerInstance;
}
