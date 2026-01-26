import { createDeduplicatedTypedWSPublish } from '../../lib/deduplicated-ws-publish';
import { createServeOptions, withRequestBody } from '../../lib/routes';
import { ExternalWeatherTimePeriod } from '../kiosk/types';
import type { TemperatureScheduleEntry } from './types';
import type { ServeOptions } from '../../lib/routes';
import { get } from '../kiosk/temperature/external';
import { LogObj } from '../../lib/logging/lob-obj';
import { getController } from './temp-controller';
import type { Device } from '../device/device';
import type { DeviceAPI } from '../device/api';
import type { ModuleConfig } from '..';
import { Data } from '../../lib/data';
import { Temperature } from './index';
import { Logs } from '../logs';
import * as z from 'zod';

function _initRouting({ sqlDB, db, modules, wsPublish: _wsPublish }: ModuleConfig) {
	// Create a deduplicated WebSocket publisher to avoid sending duplicate messages
	const wsPublish =
		createDeduplicatedTypedWSPublish<TemperatureWebsocketServerMessage>(_wsPublish);

	const allTemperatureData = new Data<TemperatureWebsocketServerMessage | undefined>(undefined);
	const updateAllTemperatureData = async (
		deviceApi: DeviceAPI,
		devices: Record<string, Device>
	) => {
		const storedDevices = deviceApi.getStoredDevices();
		const globalTarget = Temperature.getGlobalTarget();
		const insideTemperature = await Temperature.getInsideTemperature(devices, storedDevices);
		const rooms = deviceApi.getRooms(storedDevices);
		const roomsStatus = await Temperature.getAllRoomsStatus(devices, storedDevices, rooms);
		const centralThermostat = await Temperature.getCentralThermostatStatus(devices);
		const nextChange = Temperature.getNextScheduledChange();
		const activeState = Temperature.getActiveState();
		const activeStateId =
			(db.current() as { activeStateId?: string | null }).activeStateId ?? null;
		const states = Temperature.getStates();

		let nextSchedule:
			| {
					hasNext: false;
			  }
			| {
					hasNext: true;
					nextTriggerTime: string;
					targetTemperature: number;
					averageTargetTemperature: number;
					name: string;
			  };

		if (!nextChange) {
			nextSchedule = { hasNext: false };
		} else {
			const { entry, nextTriggerTime } = nextChange;
			const averageTargetTemperature = Temperature.getNextAverageTargetTemperature(rooms);
			nextSchedule = {
				hasNext: true,
				nextTriggerTime: nextTriggerTime.toISOString(),
				targetTemperature: entry.targetTemperature,
				averageTargetTemperature,
				name: entry.name,
			};
		}

		allTemperatureData.set({
			type: 'update',
			insideTemperature,
			globalTarget,
			rooms: roomsStatus,
			centralThermostat: centralThermostat
				? {
						...centralThermostat,
						targetTemperature: globalTarget,
						hardwareTargetTemperature: centralThermostat.targetTemperature,
					}
				: null,
			nextSchedule,
			activeState: {
				state: activeState,
				activeStateId,
			},
			states: states.map((s) => ({ id: s.id, name: s.name })),
		});
	};

	void modules.device.api.value.then((deviceApi) => {
		deviceApi.devices.subscribe(async (devices) => {
			await updateAllTemperatureData(deviceApi, devices ?? {});
		});
	});

	allTemperatureData.subscribe(async (data) => {
		if (data) {
			await wsPublish(data);
		}
	});

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
				const deviceApi = await modules.device.api.value;
				const devices = deviceApi.devices.current();
				const temp = await Temperature.getInsideTemperature(
					devices ?? {},
					deviceApi.getStoredDevices()
				);
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
					// Try to get with new columns, fall back to old schema
					let controllerHistory: Array<{
						temperature: number;
						time: number;
						target_temperature?: number | null;
						is_heating?: boolean | null;
					}> = [];
					try {
						controllerHistory = await sqlDB<
							Array<{
								temperature: number;
								time: number;
								target_temperature: number | null;
								is_heating: boolean | null;
							}>
						>`
							SELECT temperature, time, target_temperature, is_heating
							FROM temperatures
							WHERE location = ${deviceId}
							AND time >= ${cutoffTime}
							ORDER BY time DESC
						`;
					} catch {
						// Fall back to old schema if columns don't exist
						const oldHistory = await sqlDB<
							Array<{ temperature: number; time: number }>
						>`
							SELECT temperature, time
							FROM temperatures
							WHERE location = ${deviceId}
							AND time >= ${cutoffTime}
							ORDER BY time DESC
						`;
						controllerHistory = oldHistory.map((row) => ({
							...row,
							target_temperature: null,
							is_heating: null,
						}));
					}

					if (controllerHistory.length > 0) {
						// It's a temperature controller
						return json({
							history: controllerHistory.map((row) => ({
								temperature: row.temperature,
								timestamp: row.time,
								targetTemperature: row.target_temperature ?? null,
								isHeating: row.is_heating ?? null,
							})),
						});
					}

					// If not a controller, try to get from device module's temperatureTracker
					try {
						const deviceApi = await modules.device.api.value;
						const history = await deviceApi.temperatureTracker.getHistory(
							deviceId,
							timeframeMs
						);

						// History already includes targetTemperature and isHeating from storage
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
				const deviceApi = await modules.device.api.value;
				const devices = deviceApi.devices.current();
				const storedDevices = deviceApi.getStoredDevices();
				const rooms = await Temperature.getAllRoomsStatus(
					devices,
					storedDevices,
					deviceApi.getRooms(storedDevices)
				);
				return json({ success: true, rooms });
			},
			'/room/:roomName/target': withRequestBody(
				z.object({ target: z.number() }),
				async (body, req, _server, { json }) => {
					const { roomName } = req.params;
					Temperature.setRoomOverride(roomName, body.target);

					const deviceApi = await modules.device.api.value;
					await updateAllTemperatureData(deviceApi, deviceApi.devices.current() ?? {});
					return json({ success: true });
				}
			),
			'/room/:roomName/clear': {
				POST: async (req, _server, { json }) => {
					const { roomName } = req.params;
					Temperature.setRoomOverride(roomName, null);
					const deviceApi = await modules.device.api.value;
					await updateAllTemperatureData(deviceApi, deviceApi.devices.current() ?? {});
					return json({ success: true });
				},
			},
			'/room/:roomName/pid-measurement/start': withRequestBody(
				z.object({ targetTemperature: z.number().min(5).max(30) }),
				async (body, req, _server, { json, error }) => {
					const { roomName } = req.params;
					const result = await Temperature.startPIDMeasurement(
						roomName,
						body.targetTemperature
					);
					if (result.success) {
						return json({ success: true });
					}
					return error(result.error || 'Failed to start measurement', 400);
				}
			),
			'/room/:roomName/pid-measurement/stop': {
				POST: async (req, _server, { json }) => {
					const { roomName } = req.params;
					const result = await Temperature.stopPIDMeasurement(roomName);
					return json({ success: result.success });
				},
			},
			'/room/:roomName/pid-measurement/status': {
				GET: (req, _server, { json }) => {
					const { roomName } = req.params;
					const status = Temperature.getPIDMeasurementStatus(roomName);
					return json({ success: true, status });
				},
			},
			'/room/:roomName/pid-parameters': {
				GET: (req, _server, { json }) => {
					const { roomName } = req.params;
					const parameters = Temperature.getPIDParameters(roomName);
					return json({ success: true, parameters });
				},
				DELETE: (req, _server, { json }) => {
					const { roomName } = req.params;
					Temperature.clearPIDParameters(roomName);
					return json({ success: true });
				},
			},
			'/room/:roomName/overshoot': {
				GET: (req, _server, { json }) => {
					const { roomName } = req.params;
					const overshoot = Temperature.getRoomOvershoot(roomName);
					return json({ success: true, overshoot });
				},
				POST: withRequestBody(
					z.object({ overshoot: z.number().min(0).max(5).nullable() }),
					(body, req, _server, { json }) => {
						const { roomName } = req.params;
						Temperature.setRoomOvershoot(roomName, body.overshoot);
						return json({ success: true });
					}
				),
			},
			'/rooms/overshoot': {
				GET: (_req, _server, { json }) => {
					const overshoots = Temperature.getAllRoomOvershoots();
					return json({ success: true, overshoots });
				},
			},
			'/thermostats': async (_req, _server, { json }) => {
				const thermostats = await Temperature.getAvailableThermostats(modules);
				return json({ success: true, thermostats });
			},
			'/trvs': async (_req, _server, { json }) => {
				const trvs = await Temperature.getAllTRVs(modules);
				return json({ success: true, trvs });
			},
			'/trv/:deviceId/disable': withRequestBody(
				z.object({ disabled: z.boolean() }),
				(body, req, _server, { json }) => {
					const { deviceId } = req.params;
					Temperature.setTRVDisabled(deviceId, body.disabled);
					return json({ success: true });
				}
			),
			'/central-thermostat': {
				GET: async (_req, _server, { json }) => {
					const deviceApi = await modules.device.api.value;
					const status = await Temperature.getCentralThermostatStatus(
						deviceApi.devices.current() ?? {}
					);
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

						const deviceApi = await modules.device.api.value;
						const devices = deviceApi.devices.current() ?? {};
						const status = await Temperature.getCentralThermostatStatus(devices);
						// Publish WebSocket update
						await updateAllTemperatureData(deviceApi, devices);
						// Return updated logical target
						return json({
							success: true,
							...status,
							targetTemperature: body.targetTemperature,
						});
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
					const deviceApi = await modules.device.api.value;
					const storedDevices = deviceApi.getStoredDevices();
					const rooms = deviceApi.getRooms(storedDevices);
					const averageTargetTemperature =
						Temperature.getNextAverageTargetTemperature(rooms);
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
			'/action-history': {
				GET: async (req, _server, { json }) => {
					const url = new URL(req.url);
					const sourceFilter = url.searchParams.get('source') ?? undefined;
					try {
						const activityLog = await Logs.activityLog.value;
						const logs = await activityLog.getTemperatureStateLogs(1000, sourceFilter);
						// Also include in-memory history for backward compatibility
						const debug = Temperature.getDebugInfo();
						return json({
							success: true,
							history: [
								...logs.map((log) => ({
									timestamp: log.timestamp,
									action: log.action,
									details: log.details,
									source: log.source,
									previousState: log.previous_state,
									newState: log.new_state,
								})),
								// Include in-memory entries that might not be in DB yet
								...debug.history.map((entry) => ({
									timestamp: entry.timestamp,
									action: entry.action,
									details: entry.details,
									source: entry.source ?? 'manual',
								})),
							].sort((a, b) => b.timestamp - a.timestamp),
						});
					} catch {
						// Fallback to in-memory history if database fails
						const debug = Temperature.getDebugInfo();
						return json({ success: true, history: debug.history });
					}
				},
			},
			'/states': {
				GET: (_req, _server, { json }) => {
					const states = Temperature.getStates();
					return json({ success: true, states });
				},
				POST: withRequestBody(
					z.object({
						states: z.array(
							z.object({
								id: z.string(),
								name: z.string(),
								timeRanges: z.array(
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
							})
						),
					}),
					async (body, _req, _server, { json }) => {
						Temperature.setStates(body.states);
						const deviceApi = await modules.device.api.value;
						const devices = deviceApi.devices.current() ?? {};
						await updateAllTemperatureData(deviceApi, devices);
						return json({ success: true, states: body.states });
					}
				),
			},
			'/states/:stateId': {
				GET: (req, _server, { json, error }) => {
					const { stateId } = req.params;
					const state = Temperature.getState(stateId);
					if (!state) {
						return error(`State not found: ${stateId}`, 404);
					}
					return json({ success: true, state });
				},
				POST: withRequestBody(
					z.object({
						name: z.string().optional(),
						timeRanges: z
							.array(
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
							)
							.optional(),
					}),
					async (body, req, _server, { json, error }) => {
						const { stateId } = req.params;
						const state = Temperature.getState(stateId);
						if (!state) {
							return error(`State not found: ${stateId}`, 404);
						}
						Temperature.updateState(stateId, body);
						const deviceApi = await modules.device.api.value;
						const devices = deviceApi.devices.current() ?? {};
						await updateAllTemperatureData(deviceApi, devices);
						return json({ success: true, state: Temperature.getState(stateId) });
					}
				),
				DELETE: async (req, _server, { json, error }) => {
					const { stateId } = req.params;
					const states = Temperature.getStates();
					const index = states.findIndex((s) => s.id === stateId);
					if (index === -1) {
						return error(`State not found: ${stateId}`, 404);
					}
					const updatedStates = states.filter((s) => s.id !== stateId);
					Temperature.setStates(updatedStates);
					const deviceApi = await modules.device.api.value;
					const devices = deviceApi.devices.current() ?? {};
					await updateAllTemperatureData(deviceApi, devices);
					return json({ success: true });
				},
			},
			'/states/active': {
				GET: (_req, _server, { json }) => {
					const activeState = Temperature.getActiveState();
					const data = db.current() as { activeStateId?: string | null };
					return json({
						success: true,
						state: activeState,
						activeStateId: data.activeStateId ?? null,
					});
				},
				POST: withRequestBody(
					z.object({
						stateId: z.string().nullable(),
					}),
					async (body, _req, _server, { json, error }) => {
						if (body.stateId !== null) {
							const state = Temperature.getState(body.stateId);
							if (!state) {
								return error(`State not found: ${body.stateId}`, 404);
							}
						}
						Temperature.activateState(body.stateId);
						const deviceApi = await modules.device.api.value;
						const devices = deviceApi.devices.current() ?? {};
						await updateAllTemperatureData(deviceApi, devices);
						return json({ success: true, activeStateId: body.stateId });
					}
				),
			},
		},
		true,
		{
			open: async (ws) => {
				ws.send(JSON.stringify(await allTemperatureData.get()));
			},
			message: async () => {},
		}
	);
}

export const initRouting = _initRouting as (config: ModuleConfig) => ServeOptions<unknown>;

export type TemperatureRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;

export type TemperatureWebsocketServerMessage = {
	type: 'update';
	insideTemperature: number;
	globalTarget: number;
	rooms: Array<{
		name: string;
		currentTemperature: number;
		targetTemperature: number;
		isHeating: boolean;
		needsHeating: boolean;
		overrideActive: boolean;
		pidMeasurementActive?: boolean;
		pidParametersAvailable?: boolean;
	}>;
	centralThermostat: {
		deviceId: string;
		currentTemperature: number;
		targetTemperature: number;
		hardwareTargetTemperature: number;
		isHeating: boolean;
		mode: string;
	} | null;
	nextSchedule:
		| {
				hasNext: false;
		  }
		| {
				hasNext: true;
				nextTriggerTime: string;
				targetTemperature: number;
				averageTargetTemperature: number;
				name: string;
		  };
	activeState: {
		state: {
			id: string;
			name: string;
			timeRanges: Array<{
				id: string;
				name: string;
				days: number[];
				startTime: string;
				endTime: string;
				targetTemperature: number;
				roomExceptions?: Record<string, number>;
				enabled: boolean;
			}>;
		} | null;
		activeStateId: string | null;
	};
	states: Array<{ id: string; name: string }>;
};
