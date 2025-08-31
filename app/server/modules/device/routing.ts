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

export interface DeviceListResponse {
	devices: DeviceInfo[];
}

export function initRouting(
	{ db }: ModuleConfig,
	api: DeviceAPI
): ServeOptions {
	return createServeOptions({
		'/list': () => {
			const currentDeviceIds = api.getDeviceIds();
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
			db.setVal('device_registry', JSON.stringify(updatedDevices));

			const response: DeviceListResponse = { devices };

			return Response.json(response);
		},
		'/update-name': (req) => {
			const { deviceId, name } = z
				.object({
					deviceId: z.string(),
					name: z.string(),
				})
				.parse(req.json());

			if (api.updateDeviceName(deviceId, name)) {
				return Response.json({ success: true });
			}

			return Response.json(
				{ error: 'Device not found' },
				{ status: 404 }
			);
		},
	});
}
