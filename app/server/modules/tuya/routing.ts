import type { BrandedRouteHandlerResponse, ServeOptions } from '../../lib/routes';
import { createServeOptions, withRequestBody } from '../../lib/routes';
import type { TuyaAPI, TuyaDeviceConfig } from './api';
import type { ModuleConfig } from '../modules';
import type { BunRequest } from 'bun';
import type { Server } from 'bun';
import * as z from 'zod';

const TuyaDeviceConfigSchema = z.object({
	id: z.string(),
	key: z.string(),
	name: z.string(),
	type: z.literal('thermostat'),
});

const TuyaCredentialsSchema = z.object({
	apiKey: z.string(),
	apiSecret: z.string(),
	apiRegion: z.string(),
});

function _initRouting(_config: ModuleConfig, api: TuyaAPI | null) {
	return createServeOptions(
		{
			'/config': {
				GET: (
					_req: BunRequest,
					_server: Server,
					{ json, error }: BrandedRouteHandlerResponse
				) => {
					if (!api) {
						return error('Tuya API not initialized', 500);
					}

					const credentials = api.getCredentials();
					const devices = api.getDevices();

					return json({
						credentials,
						devices,
					});
				},
			},
			'/credentials': withRequestBody(
				TuyaCredentialsSchema,
				(body, _req, _server, { json, error }) => {
					if (!api) {
						return error('Tuya API not initialized', 500);
					}

					api.setCredentials(body.apiKey, body.apiSecret, body.apiRegion);
					return json({ success: true });
				}
			),
			'/devices': {
				GET: (
					_req: BunRequest,
					_server: Server,
					{ json, error }: BrandedRouteHandlerResponse
				) => {
					if (!api) {
						return error('Tuya API not initialized', 500);
					}

					const devices = api.getDevices();
					return json({ devices });
				},
			},
			'/devices/add': withRequestBody(
				TuyaDeviceConfigSchema,
				async (body, _req, _server, { json, error }) => {
					if (!api) {
						return error('Tuya API not initialized', 500);
					}

					try {
						await api.addDevice(body as TuyaDeviceConfig);
						return json({ success: true });
					} catch (err) {
						return error(
							err instanceof Error ? err.message : 'Failed to add device',
							500
						);
					}
				}
			),
			'/devices/remove': withRequestBody(
				z.object({ deviceId: z.string() }),
				(body, _req, _server, { json, error }) => {
					if (!api) {
						return error('Tuya API not initialized', 500);
					}

					try {
						api.removeDevice(body.deviceId);
						return json({ success: true });
					} catch (err) {
						return error(
							err instanceof Error ? err.message : 'Failed to remove device',
							500
						);
					}
				}
			),
			'/devices/update': withRequestBody(
				TuyaDeviceConfigSchema.extend({ oldId: z.string() }),
				async (body, _req, _server, { json, error }) => {
					if (!api) {
						return error('Tuya API not initialized', 500);
					}

					try {
						const { oldId, ...deviceConfig } = body;
						await api.updateDevice(oldId, deviceConfig as TuyaDeviceConfig);
						return json({ success: true });
					} catch (err) {
						return error(
							err instanceof Error ? err.message : 'Failed to update device',
							500
						);
					}
				}
			),
			'/devices/test': withRequestBody(
				TuyaDeviceConfigSchema,
				async (body, _req, _server, { json, error }) => {
					if (!api) {
						return error('Tuya API not initialized', 500);
					}

					try {
						const success = await api.testConnection(body as TuyaDeviceConfig);
						return json({ success });
					} catch (err) {
						return error(err instanceof Error ? err.message : 'Test failed', 500);
					}
				}
			),
		},
		true // auth required
	);
}

export const initRouting = _initRouting as (
	config: ModuleConfig,
	api: TuyaAPI | null
) => ServeOptions<unknown>;

export type TuyaRoutes = ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
