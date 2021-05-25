import { createExternalClass } from '../../lib/external';
import { Auth } from '../auth';
import { APIHandler } from './api';

export class ExternalHandler extends createExternalClass(false) {
	public play(): Promise<void> {
		return this.runRequest((res) => {
			return APIHandler.play(res, {
				// TODO: replace with external
				auth: Auth.Secret.getKey(),
			});
		});
	}

	public pause(): Promise<void> {
		return this.runRequest((res) => {
			return APIHandler.pause(res, {
				auth: Auth.Secret.getKey(),
			});
		});
	}

	public playpause(): Promise<void> {
		return this.runRequest((res) => {
			return APIHandler.playpause(res, {
				auth: Auth.Secret.getKey(),
			});
		});
	}

	public close(): Promise<void> {
		return this.runRequest((res) => {
			return APIHandler.close(res, {
				auth: Auth.Secret.getKey(),
			});
		});
	}

	public volumeUp(amount = 10): Promise<void> {
		return this.runRequest((res) => {
			return APIHandler.volumeUp(res, {
				auth: Auth.Secret.getKey(),
				amount,
			});
		});
	}

	public volumeDown(amount = 10): Promise<void> {
		return this.runRequest((res) => {
			return APIHandler.volumeDown(res, {
				auth: Auth.Secret.getKey(),
				amount,
			});
		});
	}

	async setVolume(amount: number): Promise<void> {
		return this.runRequest((res) => {
			return APIHandler.setVolume(res, {
				auth: Auth.Secret.getKey(),
				amount,
			});
		});
	}
}
