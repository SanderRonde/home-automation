/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
	EWeLinkConfig,
	EWeLinkWSConnection,
	WrappedEWeLinkAPI,
} from './client/clusters/shared';
import { queueEwelinkTokenRefresh } from './routing';
import { EWELINK_DEBUG } from '../../lib/constants';
import { logTag } from '../../lib/logging/logger';
import { asyncSetInterval } from '../../lib/time';
import { EwelinkDevice } from './client/device';
import { Data } from '../../lib/event-emitter';
import type { Database } from '../../lib/db';
import eWelink from 'ewelink-api-next';
import type WebSocket from 'ws';

export class EWeLinkAPI implements Disposable {
	private _disposables: Set<() => void> = new Set();

	public readonly wsConnectionWrapper = new EWeLinkWSConnection();
	private _ws: WebSocket | null = null;
	private _devices: EwelinkDevice[] = [];
	public get devices(): EwelinkDevice[] {
		return this._devices;
	}

	public constructor(
		private readonly _db: Database,
		private readonly _webApi: InstanceType<typeof eWelink.WebAPI>,
		private readonly _onDevices: (devices: EwelinkDevice[]) => void
	) {}

	public async init(token: string): Promise<this | null> {
		queueEwelinkTokenRefresh(this._webApi, this._db);

		this._webApi.at = token;
		await this.initEWeLinkDevices();
		return this;
	}

	private async initEWeLinkDevices() {
		const eventEmitters = new Map<
			string,
			Data<EwelinkDeviceResponse | undefined>
		>();
		const wrappedApi = new WrappedEWeLinkAPI(this._webApi);
		const initialDevices = await this.updateDevices(
			eventEmitters,
			wrappedApi
		);
		this._devices = initialDevices;
		this._onDevices(initialDevices);

		const interval = asyncSetInterval(
			async () => {
				this._onDevices(
					await this.updateDevices(eventEmitters, wrappedApi)
				);
			},
			1000 * 60 * 2
		);
		this._disposables.add(() => clearInterval(interval));

		logTag('ewelink', 'blue', 'API connection established');

		await this.initWebsocketListener();
	}

	private async getUserApiKey() {
		// Get family to extract API key
		const family = (await this._webApi.home.getFamily({})) as {
			data: {
				familyList:
					| {
							apikey: string;
					  }[]
					| undefined;
			};
		};
		const apiKey = family.data.familyList?.map((user) => user.apikey)[0];
		if (!apiKey) {
			logTag(
				'ewelink',
				'red',
				'No API key found any user in home for websocket connection'
			);
			return null;
		}
		return apiKey;
	}

	private async initWebsocketListener() {
		const userApiKey = await this.getUserApiKey();
		if (!userApiKey) {
			logTag(
				'ewelink',
				'red',
				'No API key found any user in home, skipping websocket connection'
			);
			return undefined;
		}

		this._ws = await this.createWebsocketListener(userApiKey);
	}

	private async updateDevices(
		eventEmitters: Map<string, Data<EwelinkDeviceResponse | undefined>>,
		wrappedApi: WrappedEWeLinkAPI
	) {
		const {
			data: { thingList: response },
		} = (await this._webApi.device.getAllThings({})) as {
			data: {
				thingList: EwelinkDeviceResponse[] | undefined;
			};
		};

		const devices: EwelinkDevice[] = [];
		for (const deviceResponse of response ?? []) {
			if (eventEmitters.has(deviceResponse.itemData.deviceid)) {
				eventEmitters
					.get(deviceResponse.itemData.deviceid)!
					.set(deviceResponse);
			} else {
				const eventEmitter = new Data<
					EwelinkDeviceResponse | undefined
				>(undefined);
				eventEmitters.set(
					deviceResponse.itemData.deviceid,
					eventEmitter
				);
				const config = new EWeLinkConfig(
					wrappedApi,
					deviceResponse,
					this.wsConnectionWrapper,
					eventEmitter
				);
				const ewelinkDevice = EwelinkDevice.from(config);
				if (ewelinkDevice) {
					devices.push(ewelinkDevice);
				}
			}
		}
		return devices;
	}

	public async refreshWebsocket(): Promise<void> {
		const userApiKey = await this.getUserApiKey();
		if (!userApiKey) {
			logTag(
				'ewelink',
				'red',
				'No API key found any user in home, skipping websocket connection'
			);
			return undefined;
		}
		this._ws?.close();
		this._ws = await this.createWebsocketListener(userApiKey);
	}

	private async createWebsocketListener(userApiKey: string) {
		const wsClient = new eWelink.Ws({
			appId: this._webApi.appId!,
			appSecret: this._webApi.appSecret!,
			region: this._webApi.region!,
		});

		logTag('ewelink', 'blue', 'Creating WS connection');
		const ws = await wsClient.Connect.create(
			{
				appId: this._webApi.appId!,
				at: this._webApi.at,
				region: this._webApi.region!,
				userApiKey,
			},
			() => {
				logTag('ewelink', 'blue', 'WS connection established');
			},
			() => {
				logTag('ewelink', 'yellow', 'WS connection closed');
				setTimeout(() => {
					void this.createWebsocketListener(userApiKey);
				}, 1000 * 60);
			},
			(error) => {
				logTag('ewelink', 'red', 'WS connection errored', error);
			},
			(_ws, msg) => {
				if (msg.data.toString() === 'pong') {
					// Just a keep-alive
					return;
				}
				try {
					const data = JSON.parse(msg.data.toString());
					if (EWELINK_DEBUG) {
						logTag(
							'ewelink',
							'blue',
							'ws-message',
							JSON.stringify(data, null, '\t')
						);
					}
					this.wsConnectionWrapper.emit(data);
				} catch (e) {
					logTag(
						'ewelink',
						'red',
						`Failed to parse ewelink message: ${msg.data.toString()}`
					);
				}
			}
		);

		return ws;
	}

	public [Symbol.dispose](): void {
		this._ws?.close();
		this._disposables.forEach((disposable) => disposable());
	}

	public async refreshWithToken(token: string): Promise<EWeLinkAPI> {
		this[Symbol.dispose]();
		const instance = new EWeLinkAPI(
			this._db,
			this._webApi,
			this._onDevices
		);
		await instance.init(token);
		return instance;
	}
}

export interface EwelinkDeviceResponse {
	itemType: number;
	index: number;
	itemData: {
		name: string;
		deviceid: string;
		apikey: string;
		brandName: string;
		productModel: string;
		devicekey: string;
		online: boolean;
		params: Record<string, unknown>;
	};
}
