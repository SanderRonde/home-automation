declare module 'st-schema' {
	export declare class STBase {
		setError(detail: string, errorEnum?: string): this;
		isError(): boolean;
	}

	interface ReqBody {
		[key: string]: unknown;
	}

	interface DevicesReqBody extends ReqBody {
		devices: {
			externalDeviceId: string;
		}[];
	}

	export declare class Component {
		addProperty(
			capability: string,
			attribute: string,
			type: string,
			minimum: number,
			maximum: number,
			units: string[]
		): Readonly<{
			type: string;
			units: string[];
			minimum: number;
			maximum: number;
		}>;
	}

	export declare class DiscoveryDevice {
		deviceUniqueId(id: string): void;
		manufacturerName(name: string): this;
		modelName(name: string): this;
		hwVersion(name: string): this;
		swVersion(name: string): this;
		roomName(name: string): this;
		addGroup(name: string): string;
		addCategory(name: string): string;
		addComponent(key: string): Component;
	}

	export declare class DiscoveryResponse extends STBase {
		addDevice(
			id: string,
			friendlyName: string,
			deviceHandlerType: import('../lib/smart-home/smart-home-types').SAMSUNG_SMART_HOME_DEVICE_TYPE
		): DiscoveryDevice;
	}

	export declare class CommandResponse extends STBase {
		addDevice(externalDeviceId: string): StateDevice;
	}

	export interface DeviceState {
		component: string;
		capability: string;
		attribute: string;
		value: any;
		unit?: string;
		data?: object;
	}

	export declare class StateDevice {
		addComponent(componentName: string): {
			addState(
				capability: string,
				attribute: string,
				value: unknown,
				unit: string,
				data: unknown
			): Readonly<DeviceState>;
		};
		addCookie(cookie: string): this;
		addState(
			componentOrState: string | DeviceState,
			capability?: string,
			attribute?: string,
			value?: unknown,
			unit?: string,
			data?: unknown
		): Readonly<DeviceState>;
		setError(detail: string, errorEnum?: string): this;
	}

	export declare class StateResponse extends STBase {
		addDevice(externalDeviceId: string, states: DeviceState[]): StateDevice;
	}

	export declare class StateRefreshResponse extends StateResponse {}

	export interface DeviceCommand {
		externalDeviceId: string;
		commands: {
			capability: string;
			component: string;
			command: string;
			arguments: unknown[];
		}[];
	}

	export declare class SchemaConnector {
		constructor(options: { clientId: string; clientSecret: string });

		enableEventLogging(level?: number): this;
		discoveryHandler(
			handler: (accessToken: string, response: DiscoveryResponse) => void
		): this;
		commandHandler(
			handler: (
				accessToken: string,
				response: CommandResponse,
				devices: DeviceCommand[],
				body: DevicesReqBody
			) => void
		): this;
		callbackTokenRequestHandler(
			handler: (
				clientId: string,
				clientSecret: string,
				body: ReqBody
			) => Promise<{
				callbackAuthentication: {
					clientId: string;
					clientSecret: string;
				};
				callbackUrls: string[];
			}>
		): this;
		callbackAccessHandler(
			handler: (
				accessToken: string,
				callbackAuthentication: {
					clientId: string;
					clientSecret: string;
				},
				callbackUrls: string[],
				body: ReqBody
			) => void
		): this;
		stateRefreshHandler(
			handler: (
				accessToken: string,
				response: StateRefreshResponse,
				body: DevicesReqBody
			) => void
		): this;
		integrationDeletedHandler(
			handler: (token: string, body: ReqBody) => void
		): this;
		interactionResultHandler(
			handler: (token: string, body: ReqBody) => void
		): this;
		handleHttpCallback(
			req: import('express').Request,
			res: import('express').Response
		): void;
	}

	export interface UpdateRequestDeviceState {
		externalDeviceId: string;
		states: DeviceState[];
	}

	export declare class StateUpdateRequest extends STBase {
		constructor(public clientId: string, public clientSecret: string);

		updateState(
			callbackUrls: string[],
			callbackAuthentication: {
				clientId: string;
				clientSecret: string;
			},
			deviceState: UpdateRequestDeviceState[]
		): Promise<unknown>;
	}
}
