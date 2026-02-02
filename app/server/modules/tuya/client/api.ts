import { TUYA_API_SOURCE } from './api-tracker';
import type { TuyaContext } from './context';

export type TuyaPropertyEnumValue<T extends string> = {
	type: 'enum';
	value: T;
};
export type TuyaPropertyBoolValue = {
	type: 'bool';
	value: boolean;
};
export type TuyaPropertyNumberValue = {
	type: 'value';
	value: number;
};
export type TuyaPropertyRawValue = {
	type: 'raw';
	value: string;
};
export type TuyaPropertyBitmapValue = {
	type: 'bitmap';
	value: number;
};
export type TuyaPropertyValue =
	| TuyaPropertyEnumValue<string>
	| TuyaPropertyBoolValue
	| TuyaPropertyNumberValue
	| TuyaPropertyRawValue
	| TuyaPropertyBitmapValue;

export type TuyaProperty = {
	code: string;
	custom_name: string;
	dp_id: number;
	time: number;
} & TuyaPropertyValue;

type TuyaDevice = {
	active_time: number;
	biz_type: number;
	category: string;
	create_time: number;
	icon: string;
	id: string;
	ip: string;
	lat: string;
	local_key: string;
	lon: string;
	model: string;
	name: string;
	online: boolean;
	owner_id: string;
	product_id: string;
	product_name: string;
	status: Array<Record<string, unknown>>;
	sub: boolean;
	time_zone: string;
	uid: string;
	update_time: number;
	uuid: string;
};

export class TuyaAPI {
	/** Polling interval in ms for device property refresh; default 15 minutes. */
	public pollingIntervalMs = 15 * 60 * 1000;

	public constructor(private readonly _context: TuyaContext) {}

	public async getUserId(anyDeviceId: string): Promise<string> {
		const deviceRequest = await this._context.request<{ uid: string }>(
			{
				method: 'GET',
				path: `/v1.0/devices/${anyDeviceId}`,
			},
			{
				source: TUYA_API_SOURCE.initialization,
				endpoint: 'getUserId',
				deviceId: anyDeviceId,
			}
		);
		return deviceRequest.result.uid;
	}

	public async getUserDevices(userId: string): Promise<TuyaDevice[]> {
		const userDevicesRequest = await this._context.request<TuyaDevice[]>(
			{
				method: 'GET',
				path: `/v1.0/users/${userId}/devices`,
			},
			{
				source: TUYA_API_SOURCE.initialization,
				endpoint: 'getUserDevices',
			}
		);
		return userDevicesRequest.result;
	}

	public async getPropertiesRaw(
		deviceId: string,
		source: string = TUYA_API_SOURCE.onDemand
	): Promise<TuyaProperty[]> {
		const propertiesRequest = await this._context.request<{
			properties: TuyaProperty[];
		}>(
			{
				method: 'GET',
				path: `/v2.0/cloud/thing/${deviceId}/shadow/properties`,
			},
			{
				source,
				endpoint: 'getProperties',
				deviceId,
			}
		);
		return propertiesRequest.result.properties;
	}

	public async getPropertiesByCode(
		deviceId: string,
		source: string = TUYA_API_SOURCE.onDemand
	): Promise<Record<string, TuyaProperty>> {
		const properties = await this.getPropertiesRaw(deviceId, source);
		return properties.reduce(
			(acc, property) => {
				acc[property.code] = property;
				return acc;
			},
			{} as Record<string, TuyaProperty>
		);
	}

	public async setProperty(
		deviceId: string,
		propertyCode: string,
		value: TuyaPropertyValue['value'],
		source: string = TUYA_API_SOURCE.temperatureControl
	): Promise<boolean> {
		return (
			await this._context.request<void>(
				{
					method: 'POST',
					path: `/v2.0/cloud/thing/${deviceId}/shadow/properties/issue`,
					body: {
						properties: JSON.stringify({ [propertyCode]: value }),
					},
				},
				{
					source,
					endpoint: 'setProperty',
					deviceId,
				}
			)
		).success;
	}
}
