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
}
