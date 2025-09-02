import keyvalHtml from '../../../client/keyval/index.html';
import { DeviceOnOffCluster } from '../device/cluster';
import { createServeOptions } from '../../lib/routes';
import type { ServeOptions } from '../../lib/routes';
import type { Database } from '../../lib/db';
import type { ModuleConfig } from '..';
import { auth } from '../../lib/auth';
import type { KeyvalDB } from '.';
import * as z from 'zod';

const KeyvalItem = z.object({
	name: z.string(),
	icon: z.string().optional(),
	deviceIds: z.array(z.string()),
});

const KeyvalGroup = z.object({
	name: z.string(),
	icon: z.string().optional(),
	items: z.array(KeyvalItem),
});

const KeyvalConfig = z.object({
	groups: z.array(KeyvalGroup),
});

export interface KeyvalItemWithValue extends z.infer<typeof KeyvalItem> {
	value: boolean | null;
}

interface KeyvalGroupWithValues
	extends Omit<z.infer<typeof KeyvalGroup>, 'items'> {
	items: KeyvalItemWithValue[];
}

export interface KeyvalConfigWithValues extends Omit<KeyvalConfig, 'groups'> {
	groups: KeyvalGroupWithValues[];
}

export type KeyvalConfig = z.infer<typeof KeyvalConfig>;

export function initRouting(
	{ modules, wsPublish }: ModuleConfig,
	db: Database<KeyvalDB>
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

	const getConfigWithValues = async (): Promise<KeyvalConfigWithValues> => {
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
			'/': keyvalHtml,
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

					const groups = KeyvalConfig.parse(await req.json());
					try {
						// Validate the config structure
						if (!groups || !Array.isArray(groups)) {
							return Response.json(
								{ error: 'Invalid config structure' },
								{ status: 400 }
							);
						}

						// Store the config
						db.update((old) => ({ ...old, groups }));

						return Response.json({ success: true });
					} catch (error) {
						return Response.json(
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
				return Response.json({ groups: configJson });
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
						return Response.json({
							success: true,
							newValue: !currentValue,
						});
					} else {
						return Response.json(
							{ error: 'Failed to toggle device' },
							{ status: 500 }
						);
					}
				} catch (error) {
					return Response.json(
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
						return Response.json({ success: true });
					} else {
						return Response.json(
							{ error: 'Failed to set device' },
							{ status: 500 }
						);
					}
				} catch (error) {
					return Response.json(
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
