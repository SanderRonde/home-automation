import { createServeOptions, withRequestBody } from '../../lib/routes';
import { ExternalWeatherTimePeriod } from '../kiosk/types';
import type { TemperatureScheduleEntry } from './types';
import type { ServeOptions } from '../../lib/routes';
import { get } from '../kiosk/temperature/external';
import { LogObj } from '../../lib/logging/lob-obj';
import { getController } from './temp-controller';
import type { ModuleConfig } from '..';
import { Temperature } from './index';
import * as z from 'zod';

function _initRouting({ sqlDB, db, modules }: ModuleConfig) {
	return createServeOptions(
		{
			'/report/:name/:temp': async (req, _server, { error, text }) => {
				const temp = parseFloat(req.params.temp);
				if (Number.isNaN(temp) || temp === 0) {
					return error(`Invalid temperature "${req.params.temp}"`, 400);
				}

				// Set last temp
				const controller = await getController(sqlDB, req.params.name);
				await controller.setLastTemp(temp);

				LogObj.fromReqRes(req).attachMessage(
					`Reported temperature: "${controller.getLastTemp()}`
				);
				return text(`Reported temperature: "${controller.getLastTemp()}"`, 200);
			},
			'/getTemp': withRequestBody(
				z.object({ name: z.string() }),
				async (body, req, _server, { json }) => {
					const controller = await getController(sqlDB, body.name);
					LogObj.fromReqRes(req).attachMessage(
						`Getting temp. Returning ${controller.getLastTemp()}`
					);
					return json({
						temp: controller.getLastTemp(),
					});
				}
			),
			'/inside-temperature': async (_req, _server, { json }) => {
				const temp = await Temperature.getInsideTemperature(modules);
				return json({ success: true, temperature: temp });
			},
			'/outside-temperature': async (_req, _server, { json }) => {
				const result = await get(ExternalWeatherTimePeriod.CURRENT);
				if (result === null) {
					return json({ success: false, error: 'Weather data unavailable' });
				}
				return json({
					success: true,
					temperature: Math.round(result.temp * 10) / 10,
				});
			},
			'/temperature-sensors': async (_req, _server, { json }) => {
				const sensors = await Temperature.getAvailableTemperatureSensors(modules, sqlDB);
				return json({ success: true, ...sensors });
			},
			'/temperature/:deviceId/:timeframe': async (req, _server, { json, error }) => {
				const deviceId = req.params.deviceId;
				const timeframeMs = parseInt(req.params.timeframe, 10);

				if (Number.isNaN(timeframeMs) || timeframeMs < 0) {
					return error(`Invalid timeframe "${req.params.timeframe}"`, 400);
				}

				const cutoffTime = Date.now() - timeframeMs;

				try {
					// First, check if it's a temperature controller (stored in temperatures table)
					const controllerHistory = await sqlDB<
						Array<{ temperature: number; time: number }>
					>`
						SELECT temperature, time
						FROM temperatures
						WHERE location = ${deviceId}
						AND time >= ${cutoffTime}
						ORDER BY time DESC
						LIMIT 1000
					`;

					if (controllerHistory.length > 0) {
						// It's a temperature controller
						return json({
							history: controllerHistory.map((row) => ({
								temperature: row.temperature,
								timestamp: row.time,
							})),
						});
					}

					// If not a controller, try to get from device module's temperatureTracker
					try {
						const deviceApi = await modules.device.api.value;
						const history = await deviceApi.temperatureTracker.getHistory(
							deviceId,
							1000,
							timeframeMs
						);
						return json({ history });
					} catch {
						// Device module might not be available or device doesn't exist
						// Return empty history instead of error
						return json({ history: [] });
					}
				} catch (err) {
					// Database error or other issue
					console.error(`Failed to fetch temperature history for ${deviceId}:`, err);
					return json({ history: [] });
				}
			},
			'/inside-temperature-sensors': {
				GET: (_req, _server, { json }) => {
					const sensors = Temperature.getInsideTemperatureSensors();
					const thermostat = Temperature.getThermostat();
					return json({ success: true, sensors, thermostat });
				},
				POST: withRequestBody(
					z.object({
						sensors: z.array(
							z.union([
								z.string(),
								z.object({
									type: z.literal('device'),
									deviceId: z.string(),
								}),
							])
						),
						thermostat: z.string().optional(),
					}),
					(body, _req, _server, { json }) => {
						db.update((old) => ({
							...old,
							insideTemperatureSensors: body.sensors,
							thermostat: body.thermostat,
						}));
						return json({
							success: true,
							sensors: body.sensors,
							thermostat: body.thermostat,
						});
					}
				),
			},
			'/rooms': async (_req, _server, { json }) => {
				const rooms = await Temperature.getAllRoomsStatus(modules);
				return json({ success: true, rooms });
			},
			'/room/:roomName/target': withRequestBody(
				z.object({ target: z.number() }),
				(body, req, _server, { json }) => {
					const { roomName } = req.params;
					Temperature.setRoomOverride(roomName, body.target);
					return json({ success: true });
				}
			),
			'/room/:roomName/clear': {
				POST: (req, _server, { json }) => {
					const { roomName } = req.params;
					Temperature.setRoomOverride(roomName, null);
					return json({ success: true });
				},
			},
			'/thermostats': async (_req, _server, { json }) => {
				const thermostats = await Temperature.getAvailableThermostats(modules);
				return json({ success: true, thermostats });
			},
			'/central-thermostat': {
				GET: async (_req, _server, { json }) => {
					const status = await Temperature.getCentralThermostatStatus(modules);
					if (!status) {
						return json({ success: true, configured: false });
					}
					// Return logical target for UI, preserve hardware target for debug
					const logicalTarget = Temperature.getGlobalTarget();
					return json({
						success: true,
						configured: true,
						...status,
						targetTemperature: logicalTarget,
						hardwareTargetTemperature: status.targetTemperature,
					});
				},
				POST: withRequestBody(
					z.object({
						targetTemperature: z.number(),
					}),
					async (body, _req, _server, { json }) => {
						// Set global override instead of hardware target
						Temperature.setGlobalOverride(body.targetTemperature);

						const status = await Temperature.getCentralThermostatStatus(modules);
						// Return updated logical target
						return json({
							success: true,
							...status,
							targetTemperature: body.targetTemperature,
						});
					}
				),
			},
			'/schedule': {
				GET: (_req, _server, { json }) => {
					const schedule = Temperature.getSchedule();
					return json({ success: true, schedule });
				},
				POST: withRequestBody(
					z.object({
						schedule: z.array(
							z.object({
								id: z.string(),
								name: z.string(),
								days: z.array(z.number().min(0).max(6)),
								startTime: z.string().regex(/^\d{2}:\d{2}$/),
								endTime: z.string().regex(/^\d{2}:\d{2}$/),
								targetTemperature: z.number().min(5).max(30),
								roomExceptions: z.record(z.string(), z.number()).optional(),
								enabled: z.boolean(),
							})
						),
					}),
					(body, _req, _server, { json }) => {
						Temperature.setSchedule(body.schedule);
						return json({ success: true, schedule: body.schedule });
					}
				),
			},
			'/schedule/next': {
				GET: async (_req, _server, { json }) => {
					const nextChange: {
						entry: TemperatureScheduleEntry;
						nextTriggerTime: Date;
					} | null = Temperature.getNextScheduledChange();
					if (!nextChange) {
						return json({
							success: true as const,
							hasNext: false as const,
						});
					}
					const { entry, nextTriggerTime } = nextChange;
					const averageTargetTemperature =
						await Temperature.getNextAverageTargetTemperature(modules);
					return json({
						success: true as const,
						hasNext: true as const,
						nextTriggerTime: nextTriggerTime.toISOString(),
						targetTemperature: entry.targetTemperature,
						averageTargetTemperature,
						name: entry.name,
					});
				},
			},
			'/debug': {
				GET: (_req, _server, { json }) => {
					return json({ success: true, debug: Temperature.getDebugInfo() });
				},
			},
		},
		true
	);
}

export const initRouting = _initRouting as (config: ModuleConfig) => ServeOptions<unknown>;

export type TemperatureRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
