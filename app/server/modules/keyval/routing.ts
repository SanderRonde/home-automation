import { DeviceOnOffCluster } from '../device/cluster';
import { createRoutes } from '../../lib/routes';
import type { Routes } from '../../lib/routes';
import type { ModuleConfig } from '..';
import { auth } from '../../lib/auth';
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

interface KeyvalItemWithValue extends z.infer<typeof KeyvalItem> {
	value: boolean;
}

interface KeyvalGroupWithValues
	extends Omit<z.infer<typeof KeyvalGroup>, 'items'> {
	items: KeyvalItemWithValue[];
}

export interface KeyvalConfigWithValues extends Omit<KeyvalConfig, 'groups'> {
	groups: KeyvalGroupWithValues[];
}

export type KeyvalConfig = z.infer<typeof KeyvalConfig>;

export function initRouting({ db, randomNum, modules }: ModuleConfig): Routes {
	const getDeviceValue = async (deviceIds: string[]): Promise<boolean> => {
		const api = await modules.device.api.value;
		try {
			// Return true if ANY device is on
			for (const deviceId of deviceIds) {
				const device = api.getDevice(deviceId);
				if (!device) {
					continue;
				}

				// Assuming device implements DeviceEndpoint from device.ts
				const onOffCluster =
					device.getClusterByType(DeviceOnOffCluster);
				if (!onOffCluster) {
					continue;
				}

				const value = await onOffCluster.isOn.value;
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
		try {
			let success = false;
			// Set ALL devices to the same value
			for (const deviceId of deviceIds) {
				const device = api.getDevice(deviceId);
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

	const addValuesToConfig = async (
		config: KeyvalConfig
	): Promise<KeyvalConfigWithValues> => {
		return Promise.all(
			config.groups.map(async (group) => {
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

	return createRoutes({
		'/': async (req) => {
			if (!auth(req)) {
				return new Response('Unauthorized', { status: 401 });
			}

			return new Response(
				`<!DOCTYPE HTML>
			<html lang="en" style="background-color: #000;">
			<head>
				<link rel="icon" href="/keyval/favicon.ico" type="image/x-icon" />
				<link rel="manifest" href="/keyval/static/manifest.json" />
				<link
					rel="apple-touch-icon"
					href="/keyval/static/apple-touch-icon.png"
				/>
				<meta
					name="description"
					content="An app for controlling keyval entries"
				/>
				<meta name="viewport" content="width=device-width, initial-scale=1" />

				<title>KeyVal Switch</title>
			</head>
			<body style="margin: 0; overflow-x: hidden">
				<div id="root" json="${JSON.stringify(await db.json(true)).replace(/"/g, '&quot;')}">
					Javascript should be enabled
				</div>
				<script
					type="module"
					src="/keyval/keyval.js?n=${randomNum}"
				></script>
			</body>
		</html>`
			);
		},
		'/config': {
			GET: async (req) => {
				if (!auth(req)) {
					return new Response('Unauthorized', { status: 401 });
				}

				const configJson = db.get('keyval_config', '{"groups":[]}');
				const config: KeyvalConfig = JSON.parse(configJson);
				console.log('config', config);
				const configWithValues = await addValuesToConfig(config);

				return Response.json(configWithValues);
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
					db.setVal('keyval_config', JSON.stringify({ groups }));

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
			const configJson = db.get('keyval_config', '{"groups":[]}');
			const config: KeyvalConfig = JSON.parse(configJson);

			return Response.json(config);
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
				const success = await setDeviceValue(deviceIds, !currentValue);

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
	});
}
