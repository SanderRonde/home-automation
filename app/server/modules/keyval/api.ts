import { errorHandle, requireParams, auth } from '../../lib/decorators';
import type { ResponseLike } from '../../lib/logging/response-logger';
import { DeviceOnOffCluster } from '../device/cluster';
import type { Database } from '../../lib/db';
import type { KeyVal } from '.';

interface KeyvalItem {
	name: string;
	icon?: string;
	deviceIds: string[];
}

interface KeyvalGroup {
	name: string;
	icon?: string;
	items: KeyvalItem[];
}

export interface KeyvalConfig {
	groups: KeyvalGroup[];
}

interface KeyvalItemWithValue extends KeyvalItem {
	value: boolean;
}

interface KeyvalGroupWithValues extends Omit<KeyvalGroup, 'items'> {
	items: KeyvalItemWithValue[];
}

export interface KeyvalConfigWithValues extends Omit<KeyvalConfig, 'groups'> {
	groups: KeyvalGroupWithValues[];
}

export class APIHandler {
	private readonly _db: Database;
	private readonly _keyval: typeof KeyVal;

	public constructor({
		db,
		keyval,
	}: {
		db: Database;
		keyval: typeof KeyVal;
	}) {
		this._db = db;
		this._keyval = keyval;
	}

	private async getDeviceValue(deviceIds: string[]): Promise<boolean> {
		try {
			// Return true if ANY device is on
			for (const deviceId of deviceIds) {
				const device = (await this._keyval.modules).device.getDevice(
					deviceId
				);
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
	}

	private async setDeviceValue(
		deviceIds: string[],
		value: boolean
	): Promise<boolean> {
		try {
			let success = false;
			// Set ALL devices to the same value
			for (const deviceId of deviceIds) {
				const device = (await this._keyval.modules).device.getDevice(
					deviceId
				);
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
	}

	private async addValuesToConfig(
		config: KeyvalConfig
	): Promise<KeyvalConfigWithValues> {
		return Promise.all(
			config.groups.map(async (group) => {
				const itemsWithValues = await Promise.all(
					group.items.map(async (item) => {
						const value = await this.getDeviceValue(item.deviceIds);
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
	}

	@errorHandle
	@auth
	public async getConfig(res: ResponseLike): Promise<KeyvalConfigWithValues> {
		const configJson = this._db.get('keyval_config', '{"groups":[]}');
		const config: KeyvalConfig = JSON.parse(configJson);
		console.log('config', config);
		const configWithValues = await this.addValuesToConfig(config);

		res.status(200);
		res.write(JSON.stringify(configWithValues));
		res.end();
		return configWithValues;
	}

	@errorHandle
	@auth
	public getConfigRaw(res: ResponseLike): KeyvalConfig {
		const configJson = this._db.get('keyval_config', '{"groups":[]}');
		const config: KeyvalConfig = JSON.parse(configJson);

		res.status(200);
		res.write(JSON.stringify(config));
		res.end();
		return config;
	}

	@errorHandle
	@auth
	@requireParams('groups')
	public setConfig(
		res: ResponseLike,
		{
			groups,
		}: {
			groups: KeyvalConfig['groups'];
		}
	): boolean {
		try {
			// Validate the config structure
			if (!groups || !Array.isArray(groups)) {
				res.status(400);
				res.write(
					JSON.stringify({ error: 'Invalid config structure' })
				);
				return false;
			}

			// Store the config
			this._db.setVal('keyval_config', JSON.stringify({ groups }));

			res.status(200);
			res.write(JSON.stringify({ success: true }));
			return true;
		} catch (error) {
			res.status(500);
			res.write(JSON.stringify({ error: 'Failed to save config' }));
			return false;
		}
	}

	@errorHandle
	@auth
	@requireParams('deviceIds')
	public async toggleDevice(
		res: ResponseLike,
		{
			deviceIds,
		}: {
			deviceIds: string[];
		}
	): Promise<boolean> {
		try {
			// Get current value
			const currentValue = await this.getDeviceValue(deviceIds);

			// Toggle it
			const success = await this.setDeviceValue(deviceIds, !currentValue);

			if (success) {
				res.status(200);
				res.write(
					JSON.stringify({ success: true, newValue: !currentValue })
				);
			} else {
				res.status(500);
				res.write(JSON.stringify({ error: 'Failed to toggle device' }));
			}

			return success;
		} catch (error) {
			res.status(500);
			res.write(JSON.stringify({ error: 'Failed to toggle device' }));
			return false;
		}
	}

	@errorHandle
	@auth
	@requireParams('deviceIds', 'value')
	public async setDevice(
		res: ResponseLike,
		{
			deviceIds,
			value,
		}: {
			deviceIds: string[];
			value: boolean;
		}
	): Promise<boolean> {
		try {
			const success = await this.setDeviceValue(deviceIds, value);

			if (success) {
				res.status(200);
				res.write(JSON.stringify({ success: true }));
			} else {
				res.status(500);
				res.write(JSON.stringify({ error: 'Failed to set device' }));
			}

			return success;
		} catch (error) {
			res.status(500);
			res.write(JSON.stringify({ error: 'Failed to set device' }));
			return false;
		}
	}
}
