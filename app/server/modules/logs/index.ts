import { SettablePromise } from '../../lib/settable-promise';
import { ActivityLog } from './activity-log';
import { initRouting } from './routing';
import type { ModuleConfig } from '..';
import { ModuleMeta } from '../meta';

export const Logs = new (class Logs extends ModuleMeta {
	public name = 'logs';
	public activityLog = new SettablePromise<ActivityLog>();

	public async init(config: ModuleConfig) {
		const activityLog = new ActivityLog(config.sqlDB);
		await activityLog.init();
		this.activityLog.set(activityLog);

		return {
			serve: initRouting(config, activityLog),
		};
	}
})();

// Endpoints that should not be logged
const SKIP_LOGGING_PATTERNS = [
	'/auth/', // Auth endpoints (login is logged separately by describer)
	'/logs/', // Don't log log fetches (avoid recursion)
	'/ws', // WebSocket endpoints
];

/**
 * Log an activity to the database.
 * This is called from the routes middleware for POST/DELETE requests.
 */
export async function logActivity(
	method: string,
	endpoint: string,
	params: Record<string, string> | null,
	body: unknown,
	userId: number | null,
	username: string | null
): Promise<void> {
	// Skip logging for certain endpoints
	for (const pattern of SKIP_LOGGING_PATTERNS) {
		if (endpoint.includes(pattern)) {
			return;
		}
	}

	try {
		const activityLog = await Logs.activityLog.value;
		await activityLog.logActivity(method, endpoint, params, body, userId, username);
	} catch (error) {
		// Don't let logging errors break the request
		console.error('Failed to log activity:', error);
	}
}
