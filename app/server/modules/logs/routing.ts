import { createServeOptions } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import type { ActivityLog } from './activity-log';
import type { ModuleConfig } from '../modules';

function _initRouting(_config: ModuleConfig, activityLog: ActivityLog) {
	return createServeOptions(
		{
			'/activity': {
				GET: async (req, _server, { json }) => {
					const url = new URL(req.url);
					const limit = parseInt(url.searchParams.get('limit') || '100', 10);
					const logs = await activityLog.getActivityLogs(Math.min(limit, 500));
					return json({ logs });
				},
			},
			'/notifications': {
				GET: async (req, _server, { json }) => {
					const url = new URL(req.url);
					const limit = parseInt(url.searchParams.get('limit') || '100', 10);
					const logs = await activityLog.getNotificationLogs(Math.min(limit, 500));
					return json({ logs });
				},
			},
		},
		true
	);
}

export const initRouting = _initRouting as (
	config: ModuleConfig,
	activityLog: ActivityLog
) => ServeOptions<unknown>;

export type LogsRoutes = ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
