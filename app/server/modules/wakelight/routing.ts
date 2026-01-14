import { createServeOptions, withRequestBody } from '../../lib/routes';
import type { WakelightLogic } from './wakelight-logic';
import type { ServeOptions } from '../../lib/routes';
import { logTag } from '../../lib/logging/logger';
import type { Database } from '../../lib/db';
import type { WakelightDB } from './types';
import * as z from 'zod';

function _initRouting(db: Database<WakelightDB>, logic: WakelightLogic) {
	return createServeOptions(
		{
			'/set': withRequestBody(
				z.object({ minutesToAlarm: z.number().positive().min(1) }),
				(body, _req, _server, { json }) => {
					logic.scheduleAlarm(body.minutesToAlarm);
					return json({ success: true });
				}
			),
			'/clear': {
				POST: (_req, _server, { json }) => {
					logic.clearAlarm();
					logTag('wakelight', 'cyan', 'Alarm cleared');
					return json({ success: true });
				},
			},
			'/status': {
				GET: (_req, _server, { json }) => {
					const alarmState = logic.getAlarmState();
					return json({
						active: logic.isActive(),
						alarm: alarmState
							? {
									alarmTimestamp: alarmState.alarmTimestamp,
									startTimestamp: alarmState.startTimestamp,
									durationMinutes: alarmState.durationMinutes,
									deviceCount: alarmState.deviceIds.length,
								}
							: null,
					});
				},
			},
			'/config': {
				GET: (_req, _server, { json }) => {
					const data = db.current();
					const config = data.config ?? {
						deviceIds: [],
						durationMinutes: 7,
					};
					return json(config);
				},
				POST: withRequestBody(
					z.object({
						deviceIds: z.array(z.string()),
						durationMinutes: z.number().positive().min(1),
					}),
					(body, _req, _server, { json, error }) => {
						try {
							db.update((data) => {
								return {
									...data,
									config: body,
								};
							});
							if (body.deviceIds.length === 0) {
								logic.clearAlarm();
							}
							logTag(
								'wakelight',
								'cyan',
								`Config updated: ${body.deviceIds.length} devices, ${body.durationMinutes} minutes`
							);
							return json({ success: true });
						} catch (err) {
							logTag('wakelight', 'red', 'Failed to update config:', err);
							return error('Failed to update config', 500);
						}
					}
				),
			},
		},
		false
	);
}

export const initRouting = _initRouting as (
	db: Database<WakelightDB>,
	logic: WakelightLogic
) => ServeOptions<unknown>;

export type WakelightRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
