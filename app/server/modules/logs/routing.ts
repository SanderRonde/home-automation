import { createServeOptions } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import type { ActivityLog } from './activity-log';
import type { ModuleConfig } from '../modules';

function _initRouting(_config: ModuleConfig, activityLog: ActivityLog) {
	return createServeOptions(
		{
			'/activity': {
				GET: async (_req, _server, { json }) => {
					const logs = await activityLog.getActivityLogs(1000);
					return json({ logs });
				},
			},
			'/notifications': {
				GET: async (_req, _server, { json }) => {
					const logs = await activityLog.getNotificationLogs(1000);
					return json({ logs });
				},
			},
			'/temperature-state-logs': {
				GET: async (req, _server, { json }) => {
					const url = new URL(req.url);
					const sourceFilter = url.searchParams.get('source') ?? undefined;
					const limit = url.searchParams.get('limit')
						? parseInt(url.searchParams.get('limit')!, 10)
						: 1000;
					const logs = await activityLog.getTemperatureStateLogs(limit, sourceFilter);
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
