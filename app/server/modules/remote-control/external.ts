import { createExternalClass } from '../../lib/external';
import { LogObj } from '../../lib/logging/lob-obj';
import { APIHandler } from './api';
import { RemoteControl } from '.';

export class ExternalHandler extends createExternalClass(false) {
	public play(): Promise<void> {
		return this.runRequest(async (res) => {
			return APIHandler.play(res, {
				// TODO: replace with external
				auth: await this._getKey(LogObj.fromRes(res), RemoteControl),
			});
		});
	}

	public pause(): Promise<void> {
		return this.runRequest(async (res) => {
			return APIHandler.pause(res, {
				auth: await this._getKey(LogObj.fromRes(res), RemoteControl),
			});
		});
	}

	public playpause(): Promise<void> {
		return this.runRequest(async (res) => {
			return APIHandler.playpause(res, {
				auth: await this._getKey(LogObj.fromRes(res), RemoteControl),
			});
		});
	}

	public close(): Promise<void> {
		return this.runRequest(async (res) => {
			return APIHandler.close(res, {
				auth: await this._getKey(LogObj.fromRes(res), RemoteControl),
			});
		});
	}

	public volumeUp(amount = 10): Promise<void> {
		return this.runRequest(async (res) => {
			return APIHandler.volumeUp(res, {
				auth: await this._getKey(LogObj.fromRes(res), RemoteControl),
				amount,
			});
		});
	}

	public volumeDown(amount = 10): Promise<void> {
		return this.runRequest(async (res) => {
			return APIHandler.volumeDown(res, {
				auth: await this._getKey(LogObj.fromRes(res), RemoteControl),
				amount,
			});
		});
	}

	public async setVolume(amount: number): Promise<void> {
		return this.runRequest(async (res) => {
			return APIHandler.setVolume(res, {
				auth: await this._getKey(LogObj.fromRes(res), RemoteControl),
				amount,
			});
		});
	}
}
