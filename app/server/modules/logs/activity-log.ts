import type { LogDescription } from './describers';
import { describeAction } from './describers';
import type { SQL } from 'bun';

export interface ActivityLogEntry {
	id: number;
	timestamp: number;
	user_id: number | null;
	username: string | null;
	method: string;
	endpoint: string;
	params: string | null;
	body: string | null;
}

export interface ActivityLogEntryWithDescription extends ActivityLogEntry {
	description: LogDescription[];
}

export interface NotificationLogEntry {
	id: number;
	timestamp: number;
	title: string;
	body: string;
	success: number;
	recipient_count: number;
}

export interface TemperatureStateLogEntry {
	id: number;
	timestamp: number;
	source: string;
	action: string;
	details: string;
	previous_state: string | null;
	new_state: string | null;
}

export interface TuyaApiLogEntry {
	id: number;
	timestamp: number;
	source: string;
	endpoint: string;
	device_id: string | null;
}

export class ActivityLog {
	public constructor(private readonly _db: SQL) {}

	public async init(): Promise<void> {
		// Create activity_logs table
		const activityTableExists = await this._db<{ name: string }[]>`
			SELECT name FROM sqlite_master WHERE type='table' AND name='activity_logs'
		`;

		if (!activityTableExists.length) {
			await this._db`
				CREATE TABLE activity_logs (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					timestamp INTEGER NOT NULL,
					user_id INTEGER,
					username TEXT,
					method TEXT NOT NULL,
					endpoint TEXT NOT NULL,
					params TEXT,
					body TEXT
				)
			`;
			// Add index for faster timestamp-based queries
			await this._db`
				CREATE INDEX idx_activity_logs_timestamp ON activity_logs(timestamp DESC)
			`;
		}

		// Create notification_logs table
		const notificationTableExists = await this._db<{ name: string }[]>`
			SELECT name FROM sqlite_master WHERE type='table' AND name='notification_logs'
		`;

		if (!notificationTableExists.length) {
			await this._db`
				CREATE TABLE notification_logs (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					timestamp INTEGER NOT NULL,
					title TEXT NOT NULL,
					body TEXT NOT NULL,
					success INTEGER NOT NULL,
					recipient_count INTEGER NOT NULL
				)
			`;
			// Add index for faster timestamp-based queries
			await this._db`
				CREATE INDEX idx_notification_logs_timestamp ON notification_logs(timestamp DESC)
			`;
		}

		// Create temperature_state_logs table
		const temperatureStateTableExists = await this._db<{ name: string }[]>`
			SELECT name FROM sqlite_master WHERE type='table' AND name='temperature_state_logs'
		`;

		if (!temperatureStateTableExists.length) {
			await this._db`
				CREATE TABLE temperature_state_logs (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					timestamp INTEGER NOT NULL,
					source TEXT NOT NULL,
					action TEXT NOT NULL,
					details TEXT,
					previous_state TEXT,
					new_state TEXT
				)
			`;
			// Add indexes for faster queries
			await this._db`
				CREATE INDEX idx_temperature_state_logs_timestamp ON temperature_state_logs(timestamp DESC)
			`;
			await this._db`
				CREATE INDEX idx_temperature_state_logs_source ON temperature_state_logs(source)
			`;
		}

		// Create tuya_api_logs table
		const tuyaApiTableExists = await this._db<{ name: string }[]>`
			SELECT name FROM sqlite_master WHERE type='table' AND name='tuya_api_logs'
		`;

		if (!tuyaApiTableExists.length) {
			await this._db`
				CREATE TABLE tuya_api_logs (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					timestamp INTEGER NOT NULL,
					source TEXT NOT NULL,
					endpoint TEXT NOT NULL,
					device_id TEXT
				)
			`;
			await this._db`
				CREATE INDEX idx_tuya_api_logs_timestamp ON tuya_api_logs(timestamp DESC)
			`;
			await this._db`
				CREATE INDEX idx_tuya_api_logs_source ON tuya_api_logs(source)
			`;
		}
	}

	public async logActivity(
		method: string,
		endpoint: string,
		params: Record<string, string> | null,
		body: unknown,
		userId: number | null,
		username: string | null
	): Promise<void> {
		const timestamp = Date.now();
		const paramsJson = params ? JSON.stringify(params) : null;

		// Truncate body if too large (> 10KB)
		let bodyJson: string | null = null;
		if (body !== null && body !== undefined) {
			const bodyStr = JSON.stringify(body);
			bodyJson = bodyStr.length > 10240 ? bodyStr.slice(0, 10240) + '...' : bodyStr;
		}

		await this._db`
			INSERT INTO activity_logs (timestamp, user_id, username, method, endpoint, params, body)
			VALUES (${timestamp}, ${userId}, ${username}, ${method}, ${endpoint}, ${paramsJson}, ${bodyJson})
		`;

		// Clean up old entries (keep last 10000)
		await this._db`
			DELETE FROM activity_logs WHERE id NOT IN (
				SELECT id FROM activity_logs ORDER BY timestamp DESC LIMIT 10000
			)
		`;
	}

	public async getActivityLogs(limit = 100): Promise<ActivityLogEntryWithDescription[]> {
		const entries = await this._db<ActivityLogEntry[]>`
			SELECT id, timestamp, user_id, username, method, endpoint, params, body
			FROM activity_logs
			ORDER BY timestamp DESC
			LIMIT ${limit}
		`;

		const entriesWithDescriptions = [];
		for (const entry of entries) {
			const description = describeAction(
				entry.method,
				entry.endpoint,
				entry.params ? JSON.parse(entry.params) : {},
				entry.body ? JSON.parse(entry.body) : null
			);
			if (description) {
				entriesWithDescriptions.push({
					...entry,
					description,
				});
			}
		}
		return entriesWithDescriptions;
	}

	public async logNotification(
		title: string,
		body: string,
		success: boolean,
		recipientCount: number
	): Promise<void> {
		const timestamp = Date.now();
		await this._db`
			INSERT INTO notification_logs (timestamp, title, body, success, recipient_count)
			VALUES (${timestamp}, ${title}, ${body}, ${success ? 1 : 0}, ${recipientCount})
		`;

		// Clean up old entries (keep last 1000)
		await this._db`
			DELETE FROM notification_logs WHERE id NOT IN (
				SELECT id FROM notification_logs ORDER BY timestamp DESC LIMIT 1000
			)
		`;
	}

	public async getNotificationLogs(limit = 100): Promise<NotificationLogEntry[]> {
		return await this._db<NotificationLogEntry[]>`
			SELECT id, timestamp, title, body, success, recipient_count
			FROM notification_logs
			ORDER BY timestamp DESC
			LIMIT ${limit}
		`;
	}

	public async logTemperatureStateChange(
		source: string,
		action: string,
		details: string,
		previousState: unknown = null,
		newState: unknown = null
	): Promise<void> {
		const timestamp = Date.now();
		const previousStateJson = previousState ? JSON.stringify(previousState) : null;
		const newStateJson = newState ? JSON.stringify(newState) : null;

		await this._db`
			INSERT INTO temperature_state_logs (timestamp, source, action, details, previous_state, new_state)
			VALUES (${timestamp}, ${source}, ${action}, ${details}, ${previousStateJson}, ${newStateJson})
		`;

		// Clean up old entries (keep last 10000)
		await this._db`
			DELETE FROM temperature_state_logs WHERE id NOT IN (
				SELECT id FROM temperature_state_logs ORDER BY timestamp DESC LIMIT 10000
			)
		`;
	}

	public async getTemperatureStateLogs(
		limit = 1000,
		sourceFilter?: string
	): Promise<TemperatureStateLogEntry[]> {
		if (sourceFilter) {
			return await this._db<TemperatureStateLogEntry[]>`
				SELECT id, timestamp, source, action, details, previous_state, new_state
				FROM temperature_state_logs
				WHERE source = ${sourceFilter}
				ORDER BY timestamp DESC
				LIMIT ${limit}
			`;
		}
		return await this._db<TemperatureStateLogEntry[]>`
			SELECT id, timestamp, source, action, details, previous_state, new_state
			FROM temperature_state_logs
			ORDER BY timestamp DESC
			LIMIT ${limit}
		`;
	}

	public async logTuyaApiCall(
		source: string,
		endpoint: string,
		deviceId: string | null = null
	): Promise<void> {
		const timestamp = Date.now();
		await this._db`
			INSERT INTO tuya_api_logs (timestamp, source, endpoint, device_id)
			VALUES (${timestamp}, ${source}, ${endpoint}, ${deviceId})
		`;

		// Clean up old entries (keep last 10000)
		await this._db`
			DELETE FROM tuya_api_logs WHERE id NOT IN (
				SELECT id FROM tuya_api_logs ORDER BY timestamp DESC LIMIT 10000
			)
		`;
	}

	public async getTuyaApiLogs(limit = 1000, sourceFilter?: string): Promise<TuyaApiLogEntry[]> {
		if (sourceFilter) {
			return await this._db<TuyaApiLogEntry[]>`
				SELECT id, timestamp, source, endpoint, device_id
				FROM tuya_api_logs
				WHERE source = ${sourceFilter}
				ORDER BY timestamp DESC
				LIMIT ${limit}
			`;
		}
		return await this._db<TuyaApiLogEntry[]>`
			SELECT id, timestamp, source, endpoint, device_id
			FROM tuya_api_logs
			ORDER BY timestamp DESC
			LIMIT ${limit}
		`;
	}

	public async getTuyaApiLogsCountBySource(): Promise<Record<string, number>> {
		const rows = await this._db<{ source: string; count: number }[]>`
			SELECT source, COUNT(*) as count
			FROM tuya_api_logs
			GROUP BY source
		`;
		return Object.fromEntries(
			rows.map((r) => [r.source, typeof r.count === 'number' ? r.count : Number(r.count)])
		);
	}
}
