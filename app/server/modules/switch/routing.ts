import switchHtml from '../../../client/switch/index.html';
import { DeviceOnOffCluster } from '../device/cluster';
import { createServeOptions } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import type { Database } from '../../lib/db';
import type { ModuleConfig } from '..';
import { auth } from '../../lib/auth';
import type { SwitchDB } from '.';
import * as z from 'zod';
import { jsonResponse } from '../../lib/typed-routes';

const SwitchItem = z.object({
	name: z.string(),
	icon: z.string().optional(),
	deviceIds: z.array(z.string()),
});

const SwitchGroup = z.object({
	name: z.string(),
	icon: z.string().optional(),
	items: z.array(SwitchItem),
});

const SwitchConfig = z.object({
	groups: z.array(SwitchGroup),
});

export interface SwitchItemWithValue extends z.infer<typeof SwitchItem> {
	value: boolean | null;
}

interface SwitchGroupWithValues
	extends Omit<z.infer<typeof SwitchGroup>, 'items'> {
	items: SwitchItemWithValue[];
}

export interface SwitchConfigWithValues extends Omit<SwitchConfig, 'groups'> {
	groups: SwitchGroupWithValues[];
}

export type SwitchConfig = z.infer<typeof SwitchConfig>;

export interface SwitchRoutes {
	'/config': {
		GET: () => Promise<SwitchConfigWithValues>
		POST: () => Promise<{success: true}|{error: string}>
	}
}

export function initRouting(
	{ modules, wsPublish }: ModuleConfig,
	db: Database<SwitchDB>
): ServeOptions {
	const getDeviceValue = async (
		deviceIds: string[]
	): Promise<boolean | null> => {
		const api = await modules.device.api.value;
		const devices = await api.devices.get();
		try {
			// Return true if ANY device is on
			for (const deviceId of deviceIds) {
				const device = devices[deviceId];
				if (!device) {
					continue;
				}

				const onOffCluster =
					device.getClusterByType(DeviceOnOffCluster);
				if (!onOffCluster) {
					continue;
				}

				const value = await onOffCluster.isOn.get();
				if (value) {
					return true;
				}
			}
			return false;
		} catch (error) {
			console.error(
				`Failed to get device values for ${deviceIds.join(', ')}:`,
				error
			);
			return false;
		}
	};

	const setDeviceValue = async (
		deviceIds: string[],
		value: boolean
	): Promise<boolean> => {
		const api = await modules.device.api.value;
		const devices = await api.devices.get();
		try {
			let success = false;
			// Set ALL devices to the same value
			for (const deviceId of deviceIds) {
				const device = devices[deviceId];
				if (!device) {
					continue;
				}

				const onOffCluster =
					device.getClusterByType(DeviceOnOffCluster);
				if (!onOffCluster) {
					continue;
				}

				await onOffCluster.setOn(value);
				success = true;
			}
			return success;
		} catch (error) {
			console.error(
				`Failed to set device values for ${deviceIds.join(', ')}:`,
				error
			);
			return false;
		}
	};

	const getConfigWithValues = async (): Promise<SwitchConfigWithValues> => {
		const configJson = db.current().groups;

		return Promise.all(
			(configJson ?? []).map(async (group) => {
				const itemsWithValues = await Promise.all(
					group.items.map(async (item) => {
						const value = await getDeviceValue(item.deviceIds);
						return {
							...item,
							value,
						};
					})
				);

				return {
					...group,
					items: itemsWithValues,
				};
			})
		).then((groupsWithValues) => ({
			groups: groupsWithValues,
		}));
	};

	const listenedDevices = new Set<string>();
	void modules.device.api.value.then((api) => {
		api.devices.subscribe((devices) => {
			const configJson = db.current().groups ?? [];
			const listenToIds = new Set<string>();
			for (const group of configJson) {
				for (const item of group.items) {
					for (const deviceId of item.deviceIds) {
						listenToIds.add(deviceId);
					}
				}
			}

			for (const device of Object.values(devices)) {
				if (
					listenedDevices.has(device.getUniqueId()) ||
					!listenToIds.has(device.getUniqueId())
				) {
					continue;
				}
				listenedDevices.add(device.getUniqueId());

				const onOffCluster =
					device.getClusterByType(DeviceOnOffCluster);
				if (!onOffCluster) {
					continue;
				}

				onOffCluster.isOn.subscribe(async () => {
					await wsPublish(
						JSON.stringify(await getConfigWithValues())
					);
				});
			}
		});
	});

	return createServeOptions(
		{
			'/': switchHtml,
			'/config': {
				GET: async (req) => {
					if (!auth(req)) {
						return new Response('Unauthorized', { status: 401 });
					}
					return Response.json(await getConfigWithValues());
				},
				POST: async (req) => {
					if (!auth(req)) {
						return new Response(null, { status: 401 });
					}

					const groups = SwitchConfig.parse(await req.json());
					try {
						// Validate the config structure
						if (!groups || !Array.isArray(groups)) {
							return jsonResponse(
								{ error: 'Invalid config structure' },
								{ status: 400 }
							);
						}

						// Store the config
						db.update((old) => ({ ...old, groups }));

						return jsonResponse({ success: true });
					} catch (error) {
						return jsonResponse(
							{ error: 'Failed to save config' },
							{ status: 500 }
						);
					}
				},
			},
			'/config/raw': (req) => {
				if (!auth(req)) {
					return new Response('Unauthorized', { status: 401 });
				}
				const configJson = db.current().groups ?? [];
				return jsonResponse({ groups: configJson });
			},
			'/device/toggle': async (req) => {
				if (!auth(req)) {
					return new Response(null, { status: 401 });
				}
				const { deviceIds } = z
					.object({
						deviceIds: z.array(z.string()),
					})
					.parse(await req.json());

				try {
					// Get current value
					const currentValue = await getDeviceValue(deviceIds);

					// Toggle it
					const success = await setDeviceValue(
						deviceIds,
						!currentValue
					);

					if (success) {
						return jsonResponse({
							success: true,
							newValue: !currentValue,
						});
					} else {
						return jsonResponse(
							{ error: 'Failed to toggle device' },
							{ status: 500 }
						);
					}
				} catch (error) {
					return jsonResponse(
						{ error: 'Failed to toggle device' },
						{ status: 500 }
					);
				}
			},
			'/device/set': async (req) => {
				if (!auth(req)) {
					return new Response('Unauthorized', { status: 401 });
				}
				const { deviceIds, value } = z
					.object({
						deviceIds: z.array(z.string()),
						value: z.boolean(),
					})
					.parse(await req.json());

				try {
					const success = await setDeviceValue(deviceIds, value);

					if (success) {
						return jsonResponse({ success: true });
					} else {
						return jsonResponse(
							{ error: 'Failed to set device' },
							{ status: 500 }
						);
					}
				} catch (error) {
					return jsonResponse(
						{ error: 'Failed to set device' },
						{ status: 500 }
					);
				}
			},
		},
		{
			open: async (ws) => {
				ws.send(JSON.stringify(await getConfigWithValues()));
			},
		}
	);
}
