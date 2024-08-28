import type { ResDummy } from '../../lib/logging/response-logger';
import { LogObj } from '../../lib/logging/lob-obj';
import { XHR } from '../../lib/util';

export class HomeAssistantAPI {
	private readonly _host: string;
	private readonly _token: string;
	private readonly _port: number;

	public constructor(credentials: {
		host: string;
		token: string;
		port?: number;
	}) {
		this._host = credentials.host;
		this._token = credentials.token;
		this._port = credentials.port || 8123;
	}

	public async setState(
		res: ResDummy,
		domain: string,
		service: string,
		entityId: string
	): Promise<boolean> {
		const logObj = LogObj.fromRes(res);
		logObj.attachMessage(`Calling service ${service} on ${entityId}`);

		const response = await XHR.post(
			`http://${this._host}/api/services/${domain}/${service}`,
			'home-assistant-service',
			{
				entity_id: entityId,
			},
			{
				port: this._port,
				headers: {
					Authorization: `Bearer ${this._token}`,
				},
			}
		);
		if (response !== null) {
			logObj.attachMessage(`Service ${service} called on ${entityId}`);
			return true;
		}
		logObj.attachMessage(`Service ${service} call failed on ${entityId}`);
		return false;
	}
}
