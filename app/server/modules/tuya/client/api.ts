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
	public constructor(private readonly _context: TuyaContext) {}

	public async getUserId(anyDeviceId: string): Promise<string> {
		const deviceRequest = await this._context.request<{ uid: string }>({
			method: 'GET',
			path: `/v1.0/devices/${anyDeviceId}`,
		});
		return deviceRequest.result.uid;
	}

	public async getUserDevices(userId: string): Promise<TuyaDevice[]> {
		const userDevicesRequest = await this._context.request<TuyaDevice[]>({
			method: 'GET',
			path: `/v1.0/users/${userId}/devices`,
		});
		return userDevicesRequest.result;
	}

	public async getPropertiesRaw(deviceId: string): Promise<TuyaProperty[]> {
		const propertiesRequest = await this._context.request<{
			properties: TuyaProperty[];
		}>({
			method: 'GET',
			path: `/v2.0/cloud/thing/${deviceId}/shadow/properties`,
		});
		return propertiesRequest.result.properties;
	}

	public async getPropertiesByCode(deviceId: string): Promise<Record<string, TuyaProperty>> {
		const properties = await this.getPropertiesRaw(deviceId);
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
		value: TuyaPropertyValue['value']
	): Promise<boolean> {
		return (
			await this._context.request<void>({
				method: 'PUT',
				path: `/v2.0/cloud/thing/${deviceId}/shadow/properties/issue`,
				body: {
					properties: JSON.stringify({ [propertyCode]: value }),
				},
			})
		).success;
	}
}
