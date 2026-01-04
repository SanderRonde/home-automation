import { createServeOptions, withRequestBody } from '../../lib/routes';
import type { SceneTrigger } from '../../../../types/scene';
import { SceneTriggerType } from '../../../../types/scene';
import type { ServeOptions } from '../../lib/routes';
import { logTag } from '../../lib/logging/logger';
import type { LocationAPI } from './location-api';
import type { ModuleConfig } from '..';
import * as z from 'zod';

function _initRouting(api: LocationAPI, config: ModuleConfig) {
	return createServeOptions(
		{
			'/update': withRequestBody(
				z.object({
					deviceId: z.string().min(1),
					latitude: z.number().min(-90).max(90),
					longitude: z.number().min(-180).max(180),
					accuracy: z.number().optional(),
					timestamp: z.number().optional(),
				}),
				async (body, _req, _server, { json, error }) => {
					try {
						await api.processLocationUpdate({
							deviceId: body.deviceId,
							latitude: body.latitude,
							longitude: body.longitude,
							accuracy: body.accuracy,
							timestamp: body.timestamp,
						});

						logTag(
							'location',
							'blue',
							`Location update for device "${body.deviceId}": [${body.latitude.toFixed(6)}, ${body.longitude.toFixed(6)}]`
						);

						// Check location triggers for this device
						void config.modules.device.api.value.then(async (deviceAPI) => {
							const scenes = deviceAPI.sceneAPI.listScenes();
							for (const scene of scenes) {
								if (!scene.triggers) {
									continue;
								}
								for (const triggerWithConditions of scene.triggers) {
									const trigger = triggerWithConditions.trigger;
									if (
										trigger.type === SceneTriggerType.LOCATION_WITHIN_RANGE &&
										trigger.deviceId === body.deviceId
									) {
										// Check if device is within range of target
										const isWithinRange = await api.isDeviceWithinRangeOfTarget(
											trigger.deviceId,
											trigger.targetId,
											trigger.rangeKm
										);
										if (isWithinRange) {
											await deviceAPI.sceneAPI.onTrigger(
												trigger as SceneTrigger
											);
										}
									}
								}
							}
						});

						return json({
							success: true,
						});
					} catch (err) {
						const errorMessage = err instanceof Error ? err.message : 'Unknown error';
						logTag('location', 'red', 'Failed to process location update:', err);
						return error(errorMessage, 400);
					}
				}
			),
			'/targets': {
				GET: (_req, _server, { json }) => {
					const targets = api.getAllTargetsWithStatus();
					return json({
						success: true,
						targets,
					});
				},
				POST: withRequestBody(
					z.object({
						id: z
							.string()
							.min(1)
							.regex(
								/^[a-zA-Z0-9_-]+$/,
								'ID must be alphanumeric with hyphens or underscores'
							),
						name: z.string().min(1),
						coordinates: z.object({
							latitude: z.number().min(-90).max(90),
							longitude: z.number().min(-180).max(180),
						}),
					}),
					(body, _req, _server, { json, error }) => {
						try {
							api.setTarget({
								id: body.id,
								name: body.name,
								coordinates: body.coordinates,
							});
							return json({ success: true });
						} catch (err) {
							const errorMessage =
								err instanceof Error ? err.message : 'Unknown error';
							logTag('location', 'red', 'Failed to create/update target:', err);
							return error(errorMessage, 400);
						}
					}
				),
			},
			'/targets/:id': {
				DELETE: (req, _server, { json, error }) => {
					const targetId = req.params.id;
					const success = api.deleteTarget(targetId);
					if (!success) {
						return error('Target not found', 404);
					}
					return json({ success: true });
				},
			},
			'/devices': {
				GET: async (_req, _server, { json }) => {
					const devices = await api.getAllDevicesWithStatus();
					return json({
						success: true,
						devices,
					});
				},
				POST: withRequestBody(
					z.object({
						id: z
							.string()
							.min(1)
							.regex(
								/^[a-zA-Z0-9_-]+$/,
								'ID must be alphanumeric with hyphens or underscores'
							),
						name: z.string().min(1),
					}),
					(body, _req, _server, { json, error }) => {
						try {
							api.setDevice({
								id: body.id,
								name: body.name,
							});
							return json({ success: true });
						} catch (err) {
							const errorMessage =
								err instanceof Error ? err.message : 'Unknown error';
							logTag('location', 'red', 'Failed to create/update device:', err);
							return error(errorMessage, 400);
						}
					}
				),
			},
			'/devices/:id': {
				DELETE: (req, _server, { json, error }) => {
					const deviceId = req.params.id;
					const success = api.deleteDevice(deviceId);
					if (!success) {
						return error('Device not found', 404);
					}
					return json({ success: true });
				},
			},
			'/devices/:id/history': {
				GET: async (req, _server, { json, error }) => {
					try {
						const deviceId = req.params.id;
						const url = new URL(req.url);
						const limitParam = url.searchParams.get('limit');
						const limit = limitParam ? parseInt(limitParam, 10) : 100;

						if (Number.isNaN(limit) || limit < 1 || limit > 1000) {
							return error('Invalid limit parameter (must be 1-1000)', 400);
						}

						const history = await api.getDeviceHistory(deviceId, limit);
						return json({
							success: true,
							history,
						});
					} catch (err) {
						const errorMessage = err instanceof Error ? err.message : 'Unknown error';
						logTag('location', 'red', 'Failed to get device history:', err);
						return error(errorMessage, 400);
					}
				},
			},
			'/targets/:id/status': {
				GET: (req, _server, { json, error }) => {
					const targetId = req.params.id;
					const target = api.getTarget(targetId);
					if (!target) {
						return error('Target not found', 404);
					}

					return json({
						success: true,
						target,
					});
				},
			},
		},
		{
			'/location/update': false,
		}
	);
}

export const initRouting = _initRouting as (
	api: LocationAPI,
	config: ModuleConfig
) => ServeOptions<unknown>;

export type LocationRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
