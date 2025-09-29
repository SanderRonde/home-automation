import { createServeOptions } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import type { DeviceAPI } from './api';
import type { ModuleConfig } from '..';
import * as z from 'zod';

export interface DeviceInfo {
	id: string;
	status: 'online' | 'offline' | 'unknown';
	lastSeen: number; // timestamp
	name?: string;
}

function _initRouting({ db }: ModuleConfig, api: DeviceAPI) {
	return createServeOptions({
		'/list': async (_req, _server, { json }) => {
			const currentDeviceIds = Object.keys(await api.devices.get());
			const knownDevices = api.getStoredDevices();
			const now = Date.now();

			// Update current devices status
			for (const deviceId of currentDeviceIds) {
				knownDevices[deviceId] = {
					id: deviceId,
					status: 'online',
					lastSeen: now,
					name: knownDevices[deviceId]?.name,
				};
			}

			// Create response with all known devices
			const devices: DeviceInfo[] = Object.values(knownDevices).map(
				(device) => ({
					...device,
					status: currentDeviceIds.includes(device.id)
						? 'online'
						: 'offline',
				})
			);

			// Sort by status (online first) then by ID
			devices.sort((a, b) => {
				if (a.status !== b.status) {
					return a.status === 'online' ? -1 : 1;
				}
				return a.id.localeCompare(b.id);
			});

			// Update the database with current status
			const updatedDevices: Record<string, DeviceInfo> = {};
			for (const device of devices) {
				updatedDevices[device.id] = device;
			}
			db.update((old) => ({ ...old, device_registry: updatedDevices }));

			return json({ devices });
		},
		'/update-name': (req, _server, { json }) => {
			const { deviceId, name } = z
				.object({
					deviceId: z.string(),
					name: z.string(),
				})
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				.parse(req.json());

			if (api.updateDeviceName(deviceId, name)) {
				return json({ success: true });
			}

			return json({ error: 'Device not found' }, { status: 404 });
		},
	});
}

export const initRouting = _initRouting as (
	config: ModuleConfig,
	api: DeviceAPI
) => ServeOptions<unknown>;

export type DeviceRoutes =
	ReturnType<typeof _initRouting> extends ServeOptions<infer R> ? R : never;
