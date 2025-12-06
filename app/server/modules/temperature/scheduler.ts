import type { TemperatureScheduleEntry } from './types';
import { logTag } from '../../lib/logging/logger';
import { Temperature } from './index';
import type { AllModules } from '..';

/**
 * Temperature Schedule Executor
 * Checks every minute if a schedule boundary has been crossed and applies the new temperature
 */
export class TemperatureScheduler {
	private readonly _modules: AllModules;
	private _intervalId: ReturnType<typeof setInterval> | null = null;
	private _lastAppliedScheduleId: string | null = null;
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
	 * Check if we need to apply a new schedule
	 */
	private async _checkSchedule(): Promise<void> {
		const now = new Date();
		const currentMinute = now.getHours() * 60 + now.getMinutes();

		// Avoid running multiple times in the same minute
		if (currentMinute === this._lastCheckMinute) {
			return;
		}
		this._lastCheckMinute = currentMinute;

		const activeSchedule = Temperature.getCurrentActiveSchedule();

		if (!activeSchedule) {
			// No active schedule - reset tracking
			this._lastAppliedScheduleId = null;
			return;
		}

		// Check if this is a new schedule we haven't applied yet
		// We need to detect schedule boundary crossings, not just "is there an active schedule"
		const scheduleKey = this._getScheduleKey(activeSchedule, now);

		if (scheduleKey === this._lastAppliedScheduleId) {
			// Already applied this schedule for this time period
			return;
		}

		// Check if we just entered this schedule (within the first minute)
		const [startHour, startMinute] = activeSchedule.startTime.split(':').map(Number);
		const scheduleStartMinutes = startHour * 60 + startMinute;

		// Only apply if we're within the first minute of the schedule start
		// This prevents applying when the server restarts mid-schedule
		if (Math.abs(currentMinute - scheduleStartMinutes) <= 1) {
			logTag(
				'temperature',
				'green',
				`Applying scheduled temperature: ${activeSchedule.targetTemperature}°C (schedule: ${activeSchedule.startTime}-${activeSchedule.endTime})`
			);

			const success = await Temperature.setCentralThermostatTarget(
				this._modules,
				activeSchedule.targetTemperature
			);

			if (success) {
				this._lastAppliedScheduleId = scheduleKey;
				logTag(
					'temperature',
					'green',
					`Successfully applied scheduled temperature: ${activeSchedule.targetTemperature}°C`
				);
			} else {
				logTag(
					'temperature',
					'red',
					`Failed to apply scheduled temperature: ${activeSchedule.targetTemperature}°C`
				);
			}
		}
	}

	/**
	 * Generate a unique key for a schedule entry on a specific day
	 * This helps track whether we've already applied a schedule
	 */
	private _getScheduleKey(schedule: TemperatureScheduleEntry, date: Date): string {
		const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
		return `${schedule.id}-${dateStr}-${schedule.startTime}`;
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
